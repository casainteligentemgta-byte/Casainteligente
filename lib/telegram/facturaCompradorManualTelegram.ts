import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarCodigoUnidad } from '@/lib/almacen/unidadesMedidaDefault';
import { resolverMaterialParaLineaCompra } from '@/lib/almacen/resolverMaterialParaCompra';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import type { ExtractedCanalHeader, ExtractedCanalItem } from '@/lib/contabilidad/extractedCanal';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { reservarFacturaCanalTelegram } from '@/lib/canal/reservarFacturaCanalTelegram';
import { avanzarFlujoFacturaCompradorTelegram } from '@/lib/telegram/flujoFacturaCompradorTelegram';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { enviarPickerProyectosTelegram } from '@/lib/telegram/proyectoPicker';

export const FLUJO_FACTURA_COMPRADOR_MANUAL = 'factura_comprador_manual';

const PREFIX = 'fcm:';

export type ContextoFacturaProcura = {
  procuraId: string;
  ticket: string;
  proyectoId: string | null;
  entidadId: string | null;
  materialId: string | null;
  materialTxt: string | null;
  cantidad: number;
  unidad: string;
};

type LineaFacturaCompradorManual = {
  material_id: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

type PasoFacturaCompradorManual =
  | 'proveedor'
  | 'num_doc'
  | 'rif'
  | 'proyecto'
  | 'material'
  | 'cantidad'
  | 'precio'
  | 'mas_lineas'
  | 'foto'
  | 'confirmar';

type MetadataFacturaCompradorManual = {
  flujo?: string;
  paso?: PasoFacturaCompradorManual;
  procura_id?: string;
  procura_ticket?: string;
  proveedor_nombre?: string;
  num_doc?: string;
  supplier_rif?: string;
  proyecto_id?: string;
  proyecto_nombre?: string;
  entidad_id?: string;
  lineas?: LineaFacturaCompradorManual[];
  draft_material_id?: string;
  draft_material_nombre?: string;
  draft_unidad?: string;
  draft_cantidad?: number;
  draft_precio?: number;
  soporte_storage_path?: string;
  soporte_file_name?: string;
  soporte_mime_type?: string;
  pending_id?: string;
};

function meta(estado: TelegramEstado): MetadataFacturaCompradorManual {
  return (estado.metadata ?? {}) as MetadataFacturaCompradorManual;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function esFlujoFacturaCompradorManual(estado: TelegramEstado): boolean {
  return meta(estado).flujo === FLUJO_FACTURA_COMPRADOR_MANUAL;
}

export function procuraIdDesdeMetadataFactura(estado: TelegramEstado): string | null {
  const id = meta(estado).procura_id?.trim();
  return id || null;
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Partial<MetadataFacturaCompradorManual>,
): Promise<TelegramEstado> {
  const nextMeta = { ...meta(estado), ...patch };
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    metadata: nextMeta,
    proyecto_id: patch.proyecto_id ?? estado.proyecto_id,
    pending_factura_id: patch.pending_id ?? estado.pending_factura_id,
  });
  return getTelegramEstado(supabase, chatId);
}

function resumenLineas(lineas: LineaFacturaCompradorManual[]): string {
  return lineas
    .map(
      (l, i) =>
        `${i + 1}. ${l.description} × ${l.quantity} ${l.unit} @ ${l.unit_price.toLocaleString('es-VE')}`,
    )
    .join('\n');
}

function totalLineas(lineas: LineaFacturaCompradorManual[]): number {
  return lineas.reduce((s, l) => s + l.quantity * l.unit_price, 0);
}

export async function iniciarFacturaCompradorManualTelegram(
  supabase: SupabaseClient,
  chatId: string,
  procura?: ContextoFacturaProcura | null,
): Promise<void> {
  const baseMeta: MetadataFacturaCompradorManual = {
    flujo: FLUJO_FACTURA_COMPRADOR_MANUAL,
    paso: 'proveedor',
    ...(procura
      ? {
          procura_id: procura.procuraId,
          procura_ticket: procura.ticket,
          proyecto_id: procura.proyectoId ?? undefined,
          entidad_id: procura.entidadId ?? undefined,
          draft_material_id: procura.materialId ?? undefined,
          draft_material_nombre: procura.materialTxt ?? undefined,
          draft_unidad: procura.unidad,
          draft_cantidad:
            Number.isFinite(procura.cantidad) && procura.cantidad > 0
              ? procura.cantidad
              : undefined,
        }
      : {}),
  };

  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    proyecto_id: procura?.proyectoId ?? null,
    metadata: baseMeta,
  });

  const ticketHint = procura?.ticket
    ? `\n🎫 Procura <b>${escHtml(procura.ticket)}</b>\n`
    : '';

  await sendTelegramMessage(
    chatId,
    '🧾 <b>Carga manual de factura</b> (comprador)\n' +
      ticketHint +
      '\n1️⃣ Escriba el <b>proveedor</b> (nombre o razón social).\n\n' +
      '<i>Registra en Contabilidad y precarga para <code>/ingreso</code> — sin sumar stock.</i>\n' +
      '<code>/cancelar</code> para abortar.',
    { parse_mode: 'HTML' },
  );
}

export async function prepararFacturaCompradorManualTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  const m = meta(estado);
  const entidad_id = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);
  const { data: proy } = await supabase
    .from('ci_proyectos')
    .select('nombre')
    .eq('id', proyectoId)
    .maybeSingle();
  const nombreObra = String(proy?.nombre ?? 'Obra').trim() || 'Obra';

  await patchMeta(supabase, chatId, estado, {
    proyecto_id: proyectoId,
    proyecto_nombre: nombreObra,
    entidad_id: entidad_id ?? undefined,
    paso: m.draft_material_id ? 'cantidad' : 'material',
  });

  if (m.draft_material_id && m.draft_material_nombre) {
    await sendTelegramMessage(
      chatId,
      `🏗️ Obra: <b>${escHtml(nombreObra)}</b>\n\n` +
        `📦 Material sugerido: <b>${escHtml(m.draft_material_nombre)}</b>\n` +
        `Escriba la <b>cantidad</b>${m.draft_unidad ? ` (${escHtml(m.draft_unidad)})` : ''}:`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    `🏗️ Obra: <b>${escHtml(nombreObra)}</b>\n\nEscriba el <b>material</b> (nombre o código del catálogo):`,
    { parse_mode: 'HTML' },
  );
}

async function preguntarMasLineas(supabase: SupabaseClient, chatId: string): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  const lineas = meta(estado).lineas ?? [];
  await patchMeta(supabase, chatId, estado, { paso: 'mas_lineas' });
  await sendTelegramMessage(
    chatId,
    `✅ Línea registrada (${lineas.length} en total).\n\n¿Agregar otra línea?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Otra línea', callback_data: `${PREFIX}mas:si` },
            { text: 'Continuar →', callback_data: `${PREFIX}mas:no` },
          ],
        ],
      },
    },
  );
}

async function preguntarFotoSoporte(supabase: SupabaseClient, chatId: string): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'foto' });
  await sendTelegramMessage(
    chatId,
    '📷 Envíe una <b>foto de la factura</b> (opcional) o pulse <b>Omitir foto</b>.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Omitir foto →', callback_data: `${PREFIX}foto:skip` }]],
      },
    },
  );
}

async function finalizarFacturaCompradorManual(
  supabase: SupabaseClient,
  chatId: string,
  chatLabel: string,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  const m = meta(estado);
  const lineas = m.lineas ?? [];
  if (!lineas.length) {
    await sendTelegramMessage(chatId, '❌ Sin líneas de factura.', { parse_mode: 'HTML' });
    return;
  }

  const items: ExtractedCanalItem[] = lineas.map((l) => ({
    description: l.description,
    item_code: l.material_id,
    unit: l.unit,
    quantity: l.quantity,
    unit_price: l.unit_price,
  }));

  const extracted: ExtractedCanalHeader = {
    invoice_number: m.num_doc?.trim() || 'S/N',
    supplier_name: m.proveedor_nombre?.trim() || 'Proveedor',
    supplier_rif: m.supplier_rif?.trim() || 'S/R',
    date: new Date().toISOString().slice(0, 10),
    total_amount: totalLineas(lineas),
    items,
    fromGemini: false,
  };

  const reserva = await reservarFacturaCanalTelegram(supabase, {
    canal: 'telegram',
    chatId,
    chatLabel,
  });
  if (!reserva.ok) {
    await sendTelegramMessage(chatId, `❌ ${escHtml(reserva.error)}`, { parse_mode: 'HTML' });
    return;
  }

  const pendingId = reserva.pendingId;
  const proyectoId = m.proyecto_id?.trim() || estado.proyecto_id?.trim() || null;

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'extraido',
      extracted,
      proyecto_id: proyectoId,
      entidad_id: m.entidad_id?.trim() || null,
      document_storage_path: m.soporte_storage_path ?? null,
      document_file_name: m.soporte_file_name ?? null,
      document_mime_type: m.soporte_mime_type ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    proyecto_id: proyectoId,
    metadata: {
      ...m,
      paso: 'confirmar',
      pending_id: pendingId,
      flujo: FLUJO_FACTURA_COMPRADOR_MANUAL,
    },
  });

  const ticket = m.procura_ticket?.trim();
  await sendTelegramMessage(
    chatId,
    '✅ <b>Datos de factura cargados</b>\n\n' +
      (ticket ? `🎫 ${escHtml(ticket)}\n` : '') +
      `🏢 ${escHtml(extracted.supplier_name ?? '')}\n` +
      `📄 ${escHtml(extracted.invoice_number ?? '')}\n` +
      `💰 Total líneas: ${totalLineas(lineas).toLocaleString('es-VE')}\n\n` +
      resumenLineas(lineas) +
      '\n\n<i>Indique moneda, forma de pago y destino (obra/almacén o gasto entidad).</i>',
    { parse_mode: 'HTML' },
  );

  await avanzarFlujoFacturaCompradorTelegram(supabase, chatId, pendingId);
}

export function esCallbackFacturaCompradorManual(data: string): boolean {
  return data.startsWith(PREFIX);
}

export async function manejarCallbackFacturaCompradorManual(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; chatLabel?: string },
): Promise<boolean> {
  if (!esCallbackFacturaCompradorManual(params.data)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoFacturaCompradorManual(estado)) {
    await answerCallbackQuery(params.callbackId, 'Flujo no activo', true);
    return true;
  }

  if (params.data === `${PREFIX}mas:si`) {
    await answerCallbackQuery(params.callbackId, 'Nueva línea');
    await patchMeta(supabase, params.chatId, estado, { paso: 'material' });
    await sendTelegramMessage(params.chatId, 'Escriba el <b>material</b> de la siguiente línea:', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (params.data === `${PREFIX}mas:no` || params.data === `${PREFIX}foto:skip`) {
    await answerCallbackQuery(params.callbackId, 'Continuando…');
    if (params.data === `${PREFIX}mas:no`) {
      await preguntarFotoSoporte(supabase, params.chatId);
    } else {
      await finalizarFacturaCompradorManual(
        supabase,
        params.chatId,
        params.chatLabel ?? params.chatId,
      );
    }
    return true;
  }

  return true;
}

export async function manejarTextoFacturaCompradorManual(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
  chatLabel: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoFacturaCompradorManual(estado)) return false;

  const paso = meta(estado).paso;
  const trimmed = texto.trim();
  if (!trimmed) return true;

  if (paso === 'proveedor') {
    await patchMeta(supabase, chatId, estado, { paso: 'num_doc', proveedor_nombre: trimmed });
    await sendTelegramMessage(chatId, '📄 Escriba el <b>número de factura</b> (<code>S/N</code> si no hay):', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (paso === 'num_doc') {
    await patchMeta(supabase, chatId, estado, { paso: 'rif', num_doc: trimmed });
    await sendTelegramMessage(
      chatId,
      '🆔 Escriba el <b>RIF del proveedor</b> o <code>-</code> para omitir:',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'rif') {
    const rif = trimmed === '-' ? 'S/R' : trimmed;
    const m = meta(estado);
    const next: Partial<MetadataFacturaCompradorManual> = {
      supplier_rif: rif,
    };

    if (m.proyecto_id?.trim() || estado.proyecto_id?.trim()) {
      const proyectoId = m.proyecto_id?.trim() || estado.proyecto_id!.trim();
      next.paso = m.draft_material_id ? 'cantidad' : 'material';
      await patchMeta(supabase, chatId, estado, next);
      if (m.draft_material_id && m.draft_material_nombre) {
        await sendTelegramMessage(
          chatId,
          `📦 Material sugerido: <b>${escHtml(m.draft_material_nombre)}</b>\nEscriba la <b>cantidad</b>:`,
          { parse_mode: 'HTML' },
        );
      } else {
        await sendTelegramMessage(chatId, 'Escriba el <b>material</b> (nombre o código):', {
          parse_mode: 'HTML',
        });
      }
      return true;
    }

    next.paso = 'proyecto';
    await patchMeta(supabase, chatId, estado, next);
    await enviarPickerProyectosTelegram(supabase, chatId, 'factura_comprador_manual');
    return true;
  }

  if (paso === 'material') {
    const proyectoId = meta(estado).proyecto_id?.trim() || estado.proyecto_id?.trim();
    if (!proyectoId) {
      await sendTelegramMessage(chatId, '⚠️ Elija primero la obra.', { parse_mode: 'HTML' });
      return true;
    }
    const resuelto = await resolverMaterialParaLineaCompra(supabase, {
      description: trimmed,
      proyectoId,
    });
    if (!resuelto?.id) {
      await sendTelegramMessage(
        chatId,
        '❌ Material no encontrado en el catálogo de la obra. Intente otro nombre o código.',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await patchMeta(supabase, chatId, estado, {
      paso: 'cantidad',
      draft_material_id: resuelto.id,
      draft_material_nombre: resuelto.name || trimmed,
      draft_unidad: normalizarCodigoUnidad('UND'),
    });
    await sendTelegramMessage(
      chatId,
      `📦 <b>${escHtml(resuelto.name || trimmed)}</b>\nEscriba la <b>cantidad</b>:`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'cantidad') {
    const qty = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      await sendTelegramMessage(chatId, '❌ Cantidad inválida. Escriba un número mayor a 0.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    await patchMeta(supabase, chatId, estado, { paso: 'precio', draft_cantidad: qty });
    await sendTelegramMessage(chatId, '💵 Escriba el <b>precio unitario</b> (sin IVA o según factura):', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (paso === 'precio') {
    const precio = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(precio) || precio < 0) {
      await sendTelegramMessage(chatId, '❌ Precio inválido.', { parse_mode: 'HTML' });
      return true;
    }
    const m = meta(estado);
    if (!m.draft_material_id || !m.draft_material_nombre || !m.draft_cantidad) {
      await sendTelegramMessage(chatId, '❌ Falta material o cantidad. Reinicie con /facturas.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const linea: LineaFacturaCompradorManual = {
      material_id: m.draft_material_id,
      description: m.draft_material_nombre,
      unit: m.draft_unidad ?? 'UND',
      quantity: m.draft_cantidad,
      unit_price: precio,
    };
    const lineas = [...(m.lineas ?? []), linea];
    await patchMeta(supabase, chatId, estado, {
      lineas,
      draft_material_id: undefined,
      draft_material_nombre: undefined,
      draft_unidad: undefined,
      draft_cantidad: undefined,
      draft_precio: undefined,
    });
    await preguntarMasLineas(supabase, chatId);
    return true;
  }

  if (paso === 'foto') {
    await sendTelegramMessage(
      chatId,
      'Envíe la <b>foto</b> o pulse <b>Omitir foto</b> en el mensaje anterior.',
      { parse_mode: 'HTML' },
    );
  }

  return true;
}

export async function manejarFotoFacturaCompradorManual(params: {
  supabase: SupabaseClient;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
  fileName?: string;
  chatLabel: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoFacturaCompradorManual(estado) || meta(estado).paso !== 'foto') return false;

  const storagePath = `facturas-comprador-manual/${params.chatId}/${Date.now()}.${params.ext}`;
  const { error: upErr } = await params.supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });
  if (upErr) {
    await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
    return true;
  }

  await patchMeta(params.supabase, params.chatId, estado, {
    soporte_storage_path: storagePath,
    soporte_file_name: params.fileName ?? `factura.${params.ext}`,
    soporte_mime_type: params.mimeType,
  });

  await finalizarFacturaCompradorManual(
    params.supabase,
    params.chatId,
    params.chatLabel,
  );
  return true;
}
