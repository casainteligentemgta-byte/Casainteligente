import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/botApi';

/** Horas de oficina (America/Caracas) en las que se recuerda a los compradores cargar facturas. */
export const HORAS_RECORDATORIO_CARACAS = [9, 10, 11, 13, 14, 15] as const;

const ZONA = 'America/Caracas';

/** Hora y día de la semana actuales en Caracas. Pura salvo por la fecha que recibe. */
export function ventanaCaracas(fecha: Date): { hora: number; diaSemana: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(fecha);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? '-1') % 24;
  const dia = partes.find((p) => p.type === 'weekday')?.value ?? '';
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hora, diaSemana: mapa[dia] ?? -1 };
}

/** Lunes a viernes, en horas de oficina. */
export function esHoraDeRecordatorio(fecha: Date): boolean {
  const { hora, diaSemana } = ventanaCaracas(fecha);
  const laboral = diaSemana >= 1 && diaSemana <= 5;
  return laboral && (HORAS_RECORDATORIO_CARACAS as readonly number[]).includes(hora);
}

/** Chats de compradores activos: usuarios de Telegram con rol Comprador y nómina de obra. */
export async function listarChatIdsCompradores(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  const { data: usuarios } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('telegram_id')
    .eq('rol', 'Comprador')
    .eq('activo', true);
  for (const r of usuarios ?? []) {
    if (r.telegram_id != null) ids.add(String(r.telegram_id));
  }
  const { data: nomina } = await supabase
    .from('ci_proyecto_nomina')
    .select('telegram_chat_id')
    .eq('rol', 'comprador')
    .eq('activo', true);
  for (const r of nomina ?? []) {
    if (r.telegram_chat_id) ids.add(String(r.telegram_chat_id));
  }
  return Array.from(ids);
}

export async function enviarRecordatorioCompradores(
  supabase: SupabaseClient,
): Promise<{ total: number; enviados: number }> {
  const chats = await listarChatIdsCompradores(supabase);
  let enviados = 0;
  for (const chatId of chats) {
    try {
      await sendTelegramMessage(
        chatId,
        '⏰ <b>Recordatorio de compras</b>\n\nCargue las facturas y notas de entrega pendientes: ' +
          'envíe la foto con <code>/facturas</code> o <code>/nota</code>.',
        { parse_mode: 'HTML' },
      );
      enviados += 1;
    } catch (err) {
      console.warn('[recordatorio compradores]', chatId, err);
    }
  }
  return { total: chats.length, enviados };
}
