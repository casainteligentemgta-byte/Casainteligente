import type { SupabaseClient } from '@supabase/supabase-js';
import { telegramApi, sendTelegramMessage } from '@/lib/telegram/botApi';
import { esChatComprador } from '@/lib/telegram/compradorRestricciones';
import {
  MENSAJE_PROCURA_SOLO_NO_DEPOSITARIO,
  TELEGRAM_BOT_COMMANDS_COMPRADOR,
  TELEGRAM_BOT_COMMANDS_DEPOSITARIO,
  mensajeAyudaTelegram,
  mensajeMenuTelegram,
} from '@/lib/telegram/botCommands';
import type { ResultadoVinculo } from '@/lib/telegram/vincularTelefonoNomina';

/** Llamada a la API de Telegram (inyectable en pruebas). */
export type TelegramBotCall = (
  method: string,
  body: Record<string, unknown>,
) => Promise<unknown>;

export function esRolDepositarioAsignacion(rol: string): boolean {
  return rol.trim().toLowerCase() === 'depositario';
}

export function esRolCompradorAsignacion(rol: string): boolean {
  return rol.trim().toLowerCase() === 'comprador';
}

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
export async function publicarMenuDepositario(
  chatId: string | number,
  call: TelegramBotCall = telegramApi,
): Promise<void> {
  try {
    await call('setMyCommands', {
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
  if (await esChatComprador(supabase, chatId)) {
    await publicarMenuComprador(chatId);
    return esMenu ? mensajeMenuTelegram({ comprador: true }) : mensajeAyudaTelegram({ comprador: true });
  }
  const depositario = await esChatDepositarioNomina(supabase, chatId);
  if (!depositario) return mensaje;
  await publicarMenuDepositario(chatId);
  return esMenu ? mensajeMenuTelegram({ depositario: true }) : mensajeAyudaTelegram({ depositario: true });
}

/** Menú nativo (botón «/») del comprador: sin procura, bitácora, ingreso ni salida. */
export async function publicarMenuComprador(
  chatId: string | number,
  call: TelegramBotCall = telegramApi,
): Promise<void> {
  try {
    await call('setMyCommands', {
      commands: TELEGRAM_BOT_COMMANDS_COMPRADOR,
      scope: { type: 'chat', chat_id: Number(chatId) },
    });
  } catch (err) {
    console.error('[telegram menu comprador]', err);
  }
}

/**
 * Justo después de autovinculación por teléfono: el menú nativo del chat
 * (botón «/») pasa al del depositario o del comprador, sin esperar a /menu.
 */
export async function publicarMenuNativoTrasVinculo(
  supabase: SupabaseClient,
  chatId: string | number,
  resultado: ResultadoVinculo,
  call: TelegramBotCall = telegramApi,
): Promise<void> {
  if (resultado.estado !== 'vinculado' && resultado.estado !== 'ya_vinculado') return;

  const depositarioPorAsignacion = resultado.asignaciones.some((a) =>
    esRolDepositarioAsignacion(a.rol),
  );
  if (depositarioPorAsignacion || (await esChatDepositarioNomina(supabase, chatId))) {
    await publicarMenuDepositario(chatId, call);
    return;
  }

  const compradorPorAsignacion = resultado.asignaciones.some((a) =>
    esRolCompradorAsignacion(a.rol),
  );
  if (compradorPorAsignacion || (await esChatComprador(supabase, chatId))) {
    await publicarMenuComprador(chatId, call);
  }
}

/** Responde a /procura de un depositario con el aviso, sin abrir el flujo. */
export async function rechazarProcuraDepositario(chatId: string | number): Promise<void> {
  await sendTelegramMessage(chatId, MENSAJE_PROCURA_SOLO_NO_DEPOSITARIO, { parse_mode: 'HTML' });
}
