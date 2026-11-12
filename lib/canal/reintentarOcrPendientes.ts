import type { SupabaseClient } from '@supabase/supabase-js';
import { descargarArchivosPendienteCanal } from '@/lib/canal/documentPartsPendiente';
import {
  columnasOcrDesconocidas,
  esCandidatoReintentoOcr,
  listarPendientesOcrReintento,
  reclamarReintentoOcr,
  type FilaReintentoOcr,
} from '@/lib/canal/reintentoExtraccionFactura';

export type ResultadoReintentosOcr = {
  revisadas: number;
  reclamadas: number;
  ok: number;
  errores: number;
};

async function procesarFilaReintentoOcr(
  supabase: SupabaseClient,
  row: FilaReintentoOcr,
): Promise<void> {
  const archivos = await descargarArchivosPendienteCanal(supabase, row);
  if (archivos.length === 0) {
    throw new Error('No hay archivo en storage para reprocesar.');
  }
  const primario = archivos[0];
  const canal = row.canal === 'whatsapp' ? 'whatsapp' : 'telegram';
  const chatId = String(row.chat_id ?? '').trim();
  const [{ processInvoiceFromCanal }, { sendTelegramMessage }] = await Promise.all([
    import('@/lib/canal/processInvoiceFromCanal'),
    import('@/lib/telegram/botApi'),
  ]);
  await processInvoiceFromCanal({
    canal,
    pendingId: row.id,
    chatId: chatId || 'ocr-reintento',
    buffer: primario.buffer,
    mimeType: primario.mimeType,
    fileName: primario.fileName,
    archivos,
    sendReply: async (text, html) => {
      if (canal !== 'telegram' || !chatId) return;
      await sendTelegramMessage(chatId, text, html ? { parse_mode: 'HTML' } : undefined);
    },
  });
}

const SELECT_REINTENTO =
  'id,estado,canal,chat_id,document_storage_path,document_mime_type,document_file_name,document_parts,ocr_intentos,ocr_proximo_reintento_at,updated_at,mensaje_error';

/**
 * Encadenado (waitUntil) o cron: una factura concreta, con la foto ya guardada.
 * `forzar` ignora `ocr_proximo_reintento_at` para no esperar al cron diario.
 */
export async function reintentarOcrPendientePorId(
  supabase: SupabaseClient,
  pendingId: string,
  opts?: {
    forzar?: boolean;
    ahora?: Date;
    procesar?: (row: FilaReintentoOcr) => Promise<void>;
  },
): Promise<ResultadoReintentosOcr> {
  const out: ResultadoReintentosOcr = {
    revisadas: 0,
    reclamadas: 0,
    ok: 0,
    errores: 0,
  };
  const id = pendingId.trim();
  if (!id) return out;

  const sel = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(SELECT_REINTENTO)
    .eq('id', id)
    .maybeSingle();
  if (sel.error) {
    if (columnasOcrDesconocidas(sel.error.message)) return out;
    throw new Error(sel.error.message);
  }
  const row = (sel.data ?? null) as FilaReintentoOcr | null;
  if (!row) return out;
  out.revisadas = 1;
  const ahoraMs = (opts?.ahora ?? new Date()).getTime();
  if (!esCandidatoReintentoOcr(row, ahoraMs, { forzar: opts?.forzar !== false })) {
    return out;
  }
  const claimed = await reclamarReintentoOcr(supabase, row.id);
  if (!claimed) return out;
  out.reclamadas = 1;
  const procesar = opts?.procesar ?? ((r) => procesarFilaReintentoOcr(supabase, r));
  try {
    await procesar(row);
    out.ok = 1;
  } catch (e) {
    out.errores = 1;
    console.warn(
      '[reintentarOcrPendientePorId]',
      row.id,
      e instanceof Error ? e.message : e,
    );
  }
  return out;
}

/**
 * Cron diario (red de seguridad) o lote: reintenta OCR con las fotos ya guardadas.
 * No avisa al cargador aquí: `processInvoiceFromCanal` solo avisa al agotar los 3 intentos.
 */
export async function reintentarOcrPendientesCanal(
  supabase: SupabaseClient,
  opts?: {
    limite?: number;
    ahora?: Date;
    procesar?: (row: FilaReintentoOcr) => Promise<void>;
  },
): Promise<ResultadoReintentosOcr> {
  const filas = await listarPendientesOcrReintento(supabase, {
    limite: opts?.limite ?? 5,
    ahora: opts?.ahora,
  });
  const out: ResultadoReintentosOcr = {
    revisadas: filas.length,
    reclamadas: 0,
    ok: 0,
    errores: 0,
  };
  const procesar = opts?.procesar ?? ((row) => procesarFilaReintentoOcr(supabase, row));

  for (const row of filas) {
    const claimed = await reclamarReintentoOcr(supabase, row.id);
    if (!claimed) continue;
    out.reclamadas += 1;
    try {
      await procesar(row);
      out.ok += 1;
    } catch (e) {
      out.errores += 1;
      console.warn(
        '[reintentarOcrPendientesCanal]',
        row.id,
        e instanceof Error ? e.message : e,
      );
    }
  }
  return out;
}
