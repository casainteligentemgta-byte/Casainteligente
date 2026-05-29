import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPurchaseInvoiceFromFile } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import { reservarFacturaCanalTelegram } from '@/lib/canal/reservarFacturaCanalTelegram';
import { linkConfirmarCompraTelegram } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import {
  downloadTelegramFile,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { enviarPickerProyectosTelegram, nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';
import type { TelegramPhotoSize } from '@/lib/telegram/aguaRegistro';
import { fileIdFotoTelegramMaxResolucion } from '@/lib/telegram/aguaRegistro';

export const NOTA_ENTREGA_KIND = 'nota_entrega_telegram';

export type PasoNotaEntrega = 'foto' | 'proveedor';

export type MetadataNotaEntrega = {
  paso?: PasoNotaEntrega;
  /** Distingue nota de entrega (depositario) de otros usos del contexto entrada_obra. */
  flujo?: 'nota_entrega';
  pending_id?: string;
  proveedor_sugerido?: string;
  telegram_message_id?: string;
};

export function esFlujoNotaEntrega(estado: TelegramEstado): boolean {
  return (
    estado.contexto === 'entrada_obra' &&
    (meta(estado).flujo === 'nota_entrega' || meta(estado).paso === 'proveedor')
  );
}

const MIN_PROVEEDOR = 2;

function meta(estado: TelegramEstado): MetadataNotaEntrega {
  return (estado.metadata ?? {}) as MetadataNotaEntrega;
}

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

function extractedNotaEntrega(
  ocr: Record<string, unknown> | null,
  proveedor: string,
): ExtractedCanalHeader {
  const items = Array.isArray(ocr?.items)
    ? (ocr.items as ExtractedCanalHeader['items'])
    : [];
  const fecha =
    typeof ocr?.date === 'string' && ocr.date.trim()
      ? ocr.date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  return {
    invoice_number:
      typeof ocr?.invoice_number === 'string' && ocr.invoice_number.trim()
        ? ocr.invoice_number.trim()
        : undefined,
    supplier_name: proveedor.trim(),
    supplier_rif:
      typeof ocr?.supplier_rif === 'string' && ocr.supplier_rif.trim()
        ? ocr.supplier_rif.trim()
        : undefined,
    date: fecha,
    total_amount:
      ocr?.total_amount != null && Number.isFinite(Number(ocr.total_amount))
        ? Number(ocr.total_amount)
        : (items ?? []).reduce(
            (s, it) => s + (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0),
            0,
          ) || null,
    items,
    fromGemini: Boolean(ocr?.fromGemini),
    modelUsed: typeof ocr?.modelUsed === 'string' ? ocr.modelUsed : undefined,
    document_kind: NOTA_ENTREGA_KIND,
    factura_pendiente: true,
  };
}

const MENSAJE_INICIO_ENTRADA =
  '📥 <b>Entrada / nota de entrega</b> (depositario)\n\n' +
  '1️⃣ Elige la obra.\n' +
  '2️⃣ Envía foto de la <b>nota de entrega</b>.\n' +
  '3️⃣ Escribe el <b>proveedor</b> (obligatorio).\n' +
  '4️⃣ Elige el almacén de ingreso.\n\n' +
  'Los productos quedarán en la cola de compras para que contabilidad complete la factura y suba su foto.\n\n' +
  '<code>/cancelar</code> para abortar.';

/** Comando unificado: /entrada (y alias /nota). */
export async function manejarComandoEntradaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'entrada_obra',
    proyecto_id: null,
    pending_factura_id: null,
    metadata: { paso: 'foto', flujo: 'nota_entrega' },
  });
  await sendTelegramMessage(chatId, MENSAJE_INICIO_ENTRADA, { parse_mode: 'HTML' });
  await enviarPickerProyectosTelegram(supabase, chatId, 'entrada_obra');
}

/** @deprecated Alias de manejarComandoEntradaTelegram */
export const manejarComandoNotaEntregaTelegram = manejarComandoEntradaTelegram;

export async function prepararNotaEntregaTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: 'entrada_obra',
    proyecto_id: proyectoId,
    pending_factura_id: null,
    metadata: { paso: 'foto', flujo: 'nota_entrega' },
  });
  await sendTelegramMessage(
    chatId,
    `📋 Obra: <b>${nombre}</b>\n\n` +
      'Envía la <b>foto de la nota de entrega</b> con los productos recibidos.',
    { parse_mode: 'HTML' },
  );
}

async function procesarFotoNotaEntrega(params: {
  supabase: SupabaseClient;
  chatId: string;
  chatLabel: string;
  proyectoId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
  telegramMessageId?: string | null;
}): Promise<{ pendingId: string; proveedorSugerido: string | null; nItems: number }> {
  const reserva = await reservarFacturaCanalTelegram(params.supabase, {
    canal: 'telegram',
    chatId: params.chatId,
    chatLabel: params.chatLabel,
    telegramMessageId: params.telegramMessageId,
  });

  if (!reserva.ok) {
    throw new Error(reserva.error);
  }

  const pendingId = reserva.pendingId;
  const storagePath = `telegram-nota-entrega/${pendingId}/${Date.now()}.${params.ext}`;

  const { error: upErr } = await params.supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: true,
    });
  if (upErr) throw new Error(`Storage: ${upErr.message}`);

  await params.supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      proyecto_id: params.proyectoId,
      document_storage_path: storagePath,
      document_file_name: `nota-entrega-${pendingId}.${params.ext}`,
      document_mime_type: params.mimeType,
      estado: 'procesando',
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  let ocr: Record<string, unknown> | null = null;
  let mensajeError: string | null = null;

  try {
    const { data, fromGemini, modelUsed } = await extractPurchaseInvoiceFromFile({
      buffer: params.buffer,
      mimeType: params.mimeType,
      fileName: `nota-entrega.${params.ext}`,
    });
    ocr = { ...data, fromGemini, modelUsed };
  } catch (e) {
    mensajeError = e instanceof Error ? e.message : 'Error OCR';
  }

  const proveedorSugerido =
    typeof ocr?.supplier_name === 'string' && ocr.supplier_name.trim()
      ? ocr.supplier_name.trim()
      : null;
  const nItems = Array.isArray(ocr?.items) ? ocr.items.length : 0;

  if (ocr && !mensajeError) {
    const extracted = extractedNotaEntrega(ocr, proveedorSugerido ?? '');
    await params.supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        estado: 'extraido',
        extracted,
        mensaje_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingId);
  } else {
    await params.supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        estado: 'error',
        mensaje_error: mensajeError,
        extracted: extractedNotaEntrega(null, proveedorSugerido ?? ''),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingId);
  }

  return { pendingId, proveedorSugerido, nItems };
}

export type ResultadoNotaEntrega = { handled: boolean; motivo?: string };

export async function manejarFotoNotaEntregaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  chatLabel: string;
  photo: TelegramPhotoSize[];
  telegramMessageId?: string | null;
}): Promise<ResultadoNotaEntrega> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoNotaEntrega(estado)) return { handled: false };

  const paso = meta(estado).paso ?? 'foto';
  if (paso !== 'foto') {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Ya recibí la foto. Escribe el nombre del <b>proveedor</b>.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'esperando_proveedor' };
  }

  if (!estado.proyecto_id) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Primero elige la obra con <code>/entrada</code>.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'sin_obra' };
  }

  const fileId = fileIdFotoTelegramMaxResolucion(params.photo);
  if (!fileId) return { handled: true, motivo: 'sin_file_id' };

  await sendTelegramMessage(
    params.chatId,
    '⏳ Analizando la nota de entrega…',
    { parse_mode: 'HTML' },
  );

  try {
    const { buffer, filePath } = await downloadTelegramFile(fileId);
    const mimeType = mimeFromTelegramPath(filePath);
    const ext = filePath.split('.').pop() ?? 'jpg';

    const { pendingId, proveedorSugerido, nItems } = await procesarFotoNotaEntrega({
      supabase: params.supabase,
      chatId: params.chatId,
      chatLabel: params.chatLabel,
      proyectoId: estado.proyecto_id,
      buffer,
      mimeType,
      ext,
      telegramMessageId: params.telegramMessageId,
    });

    const metadataActualizado: MetadataNotaEntrega = {
      paso: 'proveedor',
      flujo: 'nota_entrega',
      pending_id: pendingId,
      proveedor_sugerido: proveedorSugerido ?? undefined,
      telegram_message_id: params.telegramMessageId ?? undefined,
    };

    await setTelegramContexto(params.supabase, params.chatId, {
      pending_factura_id: pendingId,
      metadata: metadataActualizado,
    });

    const lineasMsg =
      nItems > 0
        ? `\n📦 Detecté <b>${nItems}</b> línea(s) de productos.`
        : '\n⚠️ No leí productos en la foto; contabilidad podrá agregarlos en la app.';

    const proveedorHint = proveedorSugerido
      ? `\n\nDetecté proveedor: <b>${proveedorSugerido}</b>\n` +
        'Confírmalo escribiendo el mismo nombre o corrígelo.'
      : '\n\n✏️ Escribe el <b>nombre del proveedor</b> (obligatorio).';

    await sendTelegramMessage(
      params.chatId,
      `✅ Nota de entrega cargada.${lineasMsg}${proveedorHint}`,
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'foto_ok' };
  } catch (err) {
    console.error('[telegram nota entrega foto]', err);
    await sendTelegramMessage(
      params.chatId,
      '❌ No se pudo procesar la nota. Intenta de nuevo con <code>/entrada</code>.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'error_foto' };
  }
}

export async function manejarTextoProveedorNotaEntrega(params: {
  supabase: SupabaseClient;
  chatId: string;
  texto: string;
}): Promise<ResultadoNotaEntrega> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoNotaEntrega(estado)) return { handled: false };

  const paso = meta(estado).paso;
  if (paso !== 'proveedor') return { handled: false };

  const pendingId = estado.pending_factura_id ?? meta(estado).pending_id;
  if (!pendingId || !estado.proyecto_id) {
    await sendTelegramMessage(
      params.chatId,
      '❌ Registro incompleto. Reinicia con <code>/entrada</code>.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'incompleto' };
  }

  const proveedor = params.texto.trim();
  if (proveedor.length < MIN_PROVEEDOR) {
    await sendTelegramMessage(
      params.chatId,
      `✏️ El proveedor es obligatorio (mín. ${MIN_PROVEEDOR} caracteres). Escribe el nombre del proveedor.`,
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'proveedor_corto' };
  }

  const { data: pendiente } = await params.supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();

  const prev = (pendiente?.extracted ?? {}) as ExtractedCanalHeader & Record<string, unknown>;
  const extracted = extractedNotaEntrega(prev, proveedor);

  await params.supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted,
      estado: 'extraido',
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  const nombreObra =
    (await nombreProyectoTelegram(params.supabase, estado.proyecto_id)) ?? 'Obra';
  const nItems = extracted.items?.length ?? 0;

  const { enviarPickerUbicacionesTelegram } = await import('@/lib/telegram/ubicacionPicker');
  await enviarPickerUbicacionesTelegram(params.supabase, params.chatId, {
    pendingId,
    proyectoId: estado.proyecto_id,
    nombreObra,
    esNotaEntrega: true,
  });

  await sendTelegramMessage(
    params.chatId,
    `🏢 Proveedor: <b>${proveedor}</b>\n📦 ${nItems} producto(s) en cola.\n\nElige el almacén de ingreso:`,
    { parse_mode: 'HTML' },
  );

  return { handled: true, motivo: 'proveedor_ok' };
}

export function esComandoEntradaNota(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/entrada' || t === '/nota';
}

export function mensajeNotaEntregaFinalizada(params: {
  proveedor: string;
  ubicacionNombre: string;
  nItems: number;
  pendingId: string;
}): string {
  const linkCanal = `${baseUrlApp()}/contabilidad/compras/canal?pendiente=${params.pendingId}`;
  const linkConfirm = linkConfirmarCompraTelegram(params.pendingId);
  return (
    `✅ <b>Nota de entrega registrada</b>\n\n` +
    `🏢 ${params.proveedor}\n` +
    `📦 ${params.nItems} producto(s)\n` +
    `🏭 Almacén: ${params.ubicacionNombre}\n\n` +
    `Contabilidad debe completar número de factura, montos y subir la foto de la factura:\n` +
    `<a href="${linkCanal}">Cola de compras</a>\n` +
    `<a href="${linkConfirm}">Confirmar compra</a>`
  );
}

export function esNotaEntregaExtracted(
  extracted: Record<string, unknown> | null | undefined,
): boolean {
  return String(extracted?.document_kind ?? '') === NOTA_ENTREGA_KIND;
}
