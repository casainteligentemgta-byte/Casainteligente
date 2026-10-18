import type { SupabaseClient } from '@supabase/supabase-js';
import { telegramApi, sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  MENSAJE_PROCURA_SOLO_NO_DEPOSITARIO,
  TELEGRAM_BOT_COMMANDS_DEPOSITARIO,
  mensajeAyudaTelegram,
  mensajeMenuTelegram,
} from '@/lib/telegram/botCommands';

/**
 * Un chat es de depositario cuando su teléfono/chat está en la nómina de una obra
 * con rol «depositario» activo. Los depositarios no ven procuras: ni en el menú
 * nativo de Telegram, ni en /menu o /ayuda, ni pueden abrir /procura.
 */
export async function esChatDepositarioNomina(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ci_proyecto_nomina')
      .select('id')
      .eq('telegram_chat_id', String(chatId))
      .eq('rol', 'depositario')
      .eq('activo', true)
      .limit(1);
    if (error) return false;
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/** Menú nativo (botón «/» de Telegram) limitado al chat del depositario. */
export async function publicarMenuDepositario(chatId: string | number): Promise<void> {
  try {
    await telegramApi('setMyCommands', {
      commands: TELEGRAM_BOT_COMMANDS_DEPOSITARIO,
      scope: { type: 'chat', chat_id: Number(chatId) },
    });
  } catch (err) {
    console.error('[telegram menu depositario]', err);
  }
}

/**
 * Ajusta el mensaje de /menu o /ayuda y el menú nativo según el chat.
 * Devuelve el texto que se debe enviar.
 */
export async function textoMenuParaChat(
  supabase: SupabaseClient,
  chatId: string | number,
  mensaje: string,
  esMenu: boolean,
): Promise<string> {
  const depositario = await esChatDepositarioNomina(supabase, chatId);
  if (!depositario) return mensaje;
  await publicarMenuDepositario(chatId);
  return esMenu ? mensajeMenuTelegram({ depositario: true }) : mensajeAyudaTelegram({ depositario: true });
}

/** Responde a /procura de un depositario con el aviso, sin abrir el flujo. */
export async function rechazarProcuraDepositario(chatId: string | number): Promise<void> {
  await sendTelegramMessage(chatId, MENSAJE_PROCURA_SOLO_NO_DEPOSITARIO, { parse_mode: 'HTML' });
}
