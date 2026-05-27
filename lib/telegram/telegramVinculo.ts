import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  empleadoPorTelegramChatId,
  vincularTelegramEmpleadoConToken,
} from '@/lib/campo/ingenieroResidente';
import { enviarInvitacionesAvanceIngeniero } from '@/lib/telegram/avanceCampo';

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
      `Recibirás el recordatorio diario a las 5:00 PM. ` +
      `También puedes reportar cuando quieras con el botón de abajo o escribiendo <code>/avance</code>.`,
    { parse_mode: 'HTML' },
  );

  const empleado = await empleadoPorTelegramChatId(supabase, chatId);
  if (empleado?.id) {
    const { enviados } = await enviarInvitacionesAvanceIngeniero(supabase, chatId, empleado.id);
    if (!enviados) {
      await sendTelegramMessage(
        chatId,
        'ℹ️ Aún no tienes obra asignada como ingeniero residente. Pide al administrador que registre tus datos en RRHH del proyecto.',
        { parse_mode: 'HTML' },
      );
    }
  }

  return true;
}

export async function manejarComandoAvanceCampo(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  const empleado = await empleadoPorTelegramChatId(supabase, chatId);
  if (!empleado) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Primero vincula tu cuenta con el enlace que te envió el administrador (Equipo y alertas).',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const { enviados } = await enviarInvitacionesAvanceIngeniero(supabase, chatId, empleado.id);
  if (!enviados) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No estás asignado como ingeniero residente en ninguna obra. Registra tus datos en RRHH del proyecto.',
      { parse_mode: 'HTML' },
    );
  }
}
