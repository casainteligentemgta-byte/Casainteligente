import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { vincularTelegramEmpleadoConToken } from '@/lib/campo/ingenieroResidente';

const START_PREFIX = '/start';

export function parseStartToken(text: string): string | null {
  const t = text.trim();
  if (!t.toLowerCase().startsWith(START_PREFIX)) return null;
  const rest = t.slice(START_PREFIX.length).trim();
  if (!rest) return null;
  return rest.split(/\s+/)[0] ?? null;
}

export async function manejarStartVinculoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  text: string,
  username?: string,
): Promise<boolean> {
  const token = parseStartToken(text);
  if (!token) return false;

  const result = await vincularTelegramEmpleadoConToken(
    supabase,
    token,
    Number(chatId),
    username,
  );

  if (!result.ok) {
    await sendTelegramMessage(
      chatId,
      `❌ <b>No se pudo vincular</b>\n${result.error ?? 'Token inválido'}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  await sendTelegramMessage(
    chatId,
    `✅ <b>¡Telegram sincronizado!</b>\n\nHola <b>${result.nombre ?? 'ingeniero'}</b>. ` +
      `Recibirás el recordatorio de avance diario a las 5:00 PM cuando estés asignado a una obra.\n\n` +
      `Usa el botón <b>Reportar Avance de Hoy</b> cuando llegue el mensaje.`,
    { parse_mode: 'HTML' },
  );
  return true;
}
