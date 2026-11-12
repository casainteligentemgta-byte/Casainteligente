import type { SupabaseClient } from '@supabase/supabase-js';
import { descargarArchivosPendienteCanal } from '@/lib/canal/documentPartsPendiente';
import {
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

/**
 * Cron/cola: reintenta OCR con las fotos ya guardadas (incluye álbum / document_parts).
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
