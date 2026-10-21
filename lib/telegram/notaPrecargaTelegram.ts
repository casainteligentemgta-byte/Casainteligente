import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPurchaseInvoiceFromFile } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import { normalizarCodigoUnidad } from '@/lib/almacen/unidadesMedidaDefault';
import {
  crearNotaPrecargada,
  separarLineasPrecarga,
  type LineaPrecarga,
} from '@/lib/almacen/notasPrecargadas';
import { resolverMaterialParaLineaCompra } from '@/lib/almacen/resolverMaterialParaCompra';
import {
  chatIdsDesdeDestinatarios,
  resolverDestinatariosCuarentenaTelegram,
} from '@/lib/almacen/resolverDestinatariosCuarentenaTelegram';
import { downloadTelegramFile, mimeFromTelegramPath, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramPhotoSize } from '@/lib/telegram/aguaRegistro';
import { fileIdFotoTelegramMaxResolucion } from '@/lib/telegram/aguaRegistro';
import { getTelegramEstado, setTelegramContexto, type TelegramEstado } from '@/lib/telegram/estados';
import { nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';

/**
 * Comprador: /nota → obra → foto de la nota. La IA la lee y queda PRECARGADA para el
 * depositario de esa obra. No registra ingreso ni suma stock: eso lo hace el depositario
 * al confirmar la recepción física en el almacén.
 */

export const CONTEXTO_NOTA_PRECARGA = 'nota_precarga' as const;

export function esFlujoNotaPrecarga(estado: TelegramEstado): boolean {
  return estado.contexto === CONTEXTO_NOTA_PRECARGA;
}

export async function prepararPrecargaNotaComprador(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: CONTEXTO_NOTA_PRECARGA,
    proyecto_id: proyectoId,
    pending_factura_id: null,
    metadata: { paso: 'foto' },
  });
  await sendTelegramMessage(
    chatId,
    `📋 Obra: <b>${nombre}</b>\n\n` +
      'Envíe la <b>foto de la nota de entrega</b>. Quedará precargada para el depositario de la obra; ' +
      'no suma stock hasta que él la ingrese en el almacén.\n\n<code>/cancelar</code> para salir.',
    { parse_mode: 'HTML' },
  );
}

async function avisarDepositariosNotaPrecargada(
  supabase: SupabaseClient,
  proyectoId: string,
  chatIdEmisor: string,
  texto: string,
): Promise<void> {
  const res = await resolverDestinatariosCuarentenaTelegram(supabase, { proyectoId });
  for (const chatId of chatIdsDesdeDestinatarios(res.destinatarios)) {
    if (chatId === chatIdEmisor) continue;
    try {
      await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
    } catch (err) {
      console.warn('[nota precargada] aviso depositario', chatId, err);
    }
  }
}

export async function manejarFotoNotaPrecarga(params: {
  supabase: SupabaseClient;
  chatId: string;
  chatLabel: string;
  photo: TelegramPhotoSize[];
}): Promise<void> {
  const { supabase, chatId } = params;
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoNotaPrecarga(estado)) return;

  const proyectoId = estado.proyecto_id;
  if (!proyectoId) {
    await sendTelegramMessage(chatId, '⚠️ Primero elija la obra con <code>/nota</code>.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const fileId = fileIdFotoTelegramMaxResolucion(params.photo);
  if (!fileId) return;

  await sendTelegramMessage(chatId, '⏳ Leyendo la nota de entrega…', { parse_mode: 'HTML' });

  const { buffer, filePath } = await downloadTelegramFile(fileId);
  const mimeType = mimeFromTelegramPath(filePath);
  const ext = filePath.split('.').pop() ?? 'jpg';

  let ocr;
  try {
    ({ data: ocr } = await extractPurchaseInvoiceFromFile({
      buffer,
      mimeType,
      fileName: `nota-entrega.${ext}`,
    }));
  } catch {
    await sendTelegramMessage(
      chatId,
      '❌ No pude leer la nota. Envíe otra foto más nítida, o <code>/cancelar</code>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const lineas: LineaPrecarga[] = [];
  for (const it of ocr.items ?? []) {
    const descripcion = String(it.description ?? '').trim();
    const cantidad = Number(it.quantity);
    if (!descripcion || !(cantidad > 0)) continue;
    const itemCode = String(it.item_code ?? '').trim() || null;
    const mat = await resolverMaterialParaLineaCompra(supabase, {
      description: descripcion,
      item_code: itemCode ?? undefined,
      proyectoId,
    });
    lineas.push({
      descripcion,
      cantidad,
      unidad: normalizarCodigoUnidad(String(it.unit ?? 'UND')),
      material_id: mat?.id ?? null,
      material_nombre: mat?.name ?? null,
      item_code: itemCode,
    });
  }

  if (!lineas.length) {
    await sendTelegramMessage(
      chatId,
      '❌ No encontré artículos en la nota. Envíe otra foto, o <code>/cancelar</code>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const proveedor = String(ocr.supplier_name ?? '').trim() || 'Proveedor sin identificar';
  const numDoc = String(ocr.invoice_number ?? '').trim() || 'S/N';
  const fecha = typeof ocr.date === 'string' && ocr.date.trim() ? ocr.date.slice(0, 10) : null;

  const storagePath = `notas-precargadas/${proyectoId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  const creada = await crearNotaPrecargada(supabase, {
    proyecto_id: proyectoId,
    proveedor_nombre: proveedor,
    proveedor_rif: typeof ocr.supplier_rif === 'string' ? ocr.supplier_rif.trim() || null : null,
    num_doc: numDoc,
    fecha,
    lineas,
    soporte_storage_path: upErr ? null : storagePath,
    soporte_file_name: upErr ? null : `nota-entrega.${ext}`,
    soporte_mime_type: upErr ? null : mimeType,
    cargado_por_chat_id: chatId,
    cargado_por_label: params.chatLabel,
  });

  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    pending_factura_id: null,
    metadata: {},
  });

  if (!creada.ok) {
    await sendTelegramMessage(chatId, `❌ No se pudo guardar la precarga: ${creada.error}`, {
      parse_mode: 'HTML',
    });
    return;
  }

  const { conMaterial, sinMaterial } = separarLineasPrecarga(lineas);
  const avisoSin =
    sinMaterial.length > 0
      ? `\n⚠️ ${sinMaterial.length} artículo(s) sin vincular al catálogo: el depositario los agregará a mano.`
      : '';

  await sendTelegramMessage(
    chatId,
    `✅ <b>Nota precargada</b>\n${proveedor} · #${numDoc}\n` +
      `${lineas.length} artículo(s), ${conMaterial.length} vinculado(s) al catálogo.` +
      avisoSin +
      '\n\nEl depositario de la obra la ingresará cuando esté en el almacén.',
    { parse_mode: 'HTML' },
  );

  await avisarDepositariosNotaPrecargada(
    supabase,
    proyectoId,
    chatId,
    `📥 <b>Nota precargada por compras</b>\n${proveedor} · #${numDoc}\n` +
      `${lineas.length} artículo(s). Ingrésela en <code>/nota</code> cuando esté en el almacén.`,
  );
}
