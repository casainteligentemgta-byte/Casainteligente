import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProgresoFacturaCanal } from '@/lib/canal/processInvoiceFromCanal';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  conProgresoSimulado,
  crearNotificadorProgresoFacturaTelegram,
  TEXTO_LEYENDO_ANTERIOR,
  type NotificadorProgresoFacturaTelegram,
} from '@/lib/telegram/facturaProgresoTelegram';

/** Columna de la migración 407. Si aún no existe, todo sigue funcionando sin ella. */
export const COLUMNA_MENSAJE_ESTADO = 'telegram_status_message_id';

/** Una lectura sin movimiento por más de esto se considera de otra carga ya caída. */
export const LECTURA_EN_CURSO_MAX_MS = 3 * 60 * 1000;

export function esIdMensajeTelegram(valor: unknown): valor is number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n);
}

export async function guardarMensajeEstadoLectura(
  supabase: SupabaseClient,
  pendingId: string,
  messageId: number,
): Promise<void> {
  if (!pendingId || !esIdMensajeTelegram(messageId)) return;
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({ [COLUMNA_MENSAJE_ESTADO]: messageId })
    .eq('id', pendingId);
  if (error && !/telegram_status_message_id|PGRST204|42703|schema cache/i.test(error.message)) {
    console.warn('[estadoLecturaFactura] guardar', error.message);
  }
}

export async function leerMensajeEstadoLectura(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select(COLUMNA_MENSAJE_ESTADO)
      .eq('id', pendingId)
      .maybeSingle();
    if (error || !data) return null;
    const id = (data as unknown as Record<string, unknown>)[COLUMNA_MENSAJE_ESTADO];
    return esIdMensajeTelegram(id) ? Number(id) : null;
  } catch {
    return null;
  }
}

/** Notificador de Telegram con el id del mensaje guardado en la fila (editable luego). */
export function crearProgresoFacturaTelegram(
  chatId: string,
  opts?: {
    supabase?: SupabaseClient | null;
    pendingId?: string | null;
    messageId?: number | null;
  },
): ProgresoFacturaCanal & Pick<NotificadorProgresoFacturaTelegram, 'cerrar' | 'tieneMensaje'> {
  const supabase = opts?.supabase ?? null;
  const pendingId = opts?.pendingId ?? null;
  const notif = crearNotificadorProgresoFacturaTelegram(chatId, {
    messageId: opts?.messageId ?? null,
    onMessageId: async (id) => {
      if (supabase && pendingId) await guardarMensajeEstadoLectura(supabase, pendingId, id);
    },
  });
  return {
    reportar: notif.reportar,
    ok: notif.ok,
    bad: notif.bad,
    cerrar: notif.cerrar,
    tieneMensaje: notif.tieneMensaje,
    conSimulacion: (desde, hasta, etapa, trabajo) =>
      conProgresoSimulado(desde, hasta, notif.reportar, etapa, trabajo),
  };
}

export type FilaLecturaEnCurso = {
  id?: string | null;
  estado?: string | null;
  extracted?: unknown;
  updated_at?: string | null;
};

/**
 * ¿Esta fila es una lectura realmente en curso? `procesando`, sin datos leídos todavía
 * (una compra que se está confirmando ya tiene `extracted`) y con movimiento reciente.
 */
export function esLecturaEnCurso(
  row: FilaLecturaEnCurso,
  ahoraMs: number = Date.now(),
): boolean {
  if (String(row.estado ?? '').toLowerCase() !== 'procesando') return false;
  if (row.extracted != null) return false;
  const updated = Date.parse(String(row.updated_at ?? ''));
  if (!Number.isFinite(updated)) return false;
  return ahoraMs - updated < LECTURA_EN_CURSO_MAX_MS;
}

export async function hayLecturaEnCurso(
  supabase: SupabaseClient,
  chatId: string,
  exceptoPendingId: string,
  ahoraMs: number = Date.now(),
): Promise<boolean> {
  try {
    const desde = new Date(ahoraMs - LECTURA_EN_CURSO_MAX_MS).toISOString();
    const { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('id, estado, extracted, updated_at')
      .eq('canal', 'telegram')
      .eq('chat_id', chatId)
      .eq('estado', 'procesando')
      .is('extracted', null)
      .gte('updated_at', desde)
      .neq('id', exceptoPendingId)
      .limit(1);
    if (error) return false;
    return ((data ?? []) as FilaLecturaEnCurso[]).some((r) => esLecturaEnCurso(r, ahoraMs));
  } catch {
    return false;
  }
}

/**
 * Si el comprador manda otro documento mientras se lee uno, se le avisa que espere.
 * El nuevo NO se descarta: sigue su camino normal y se lee igual. Nunca lanza.
 */
export async function avisarSiHayLecturaEnCurso(
  supabase: SupabaseClient,
  chatId: string,
  pendingIdNuevo: string,
): Promise<boolean> {
  try {
    if (!(await hayLecturaEnCurso(supabase, chatId, pendingIdNuevo))) return false;
    await sendTelegramMessage(chatId, `⏳ ${TEXTO_LEYENDO_ANTERIOR}`, { parse_mode: 'HTML' });
    return true;
  } catch (e) {
    console.warn('[estadoLecturaFactura] aviso lectura en curso', e instanceof Error ? e.message : e);
    return false;
  }
}
