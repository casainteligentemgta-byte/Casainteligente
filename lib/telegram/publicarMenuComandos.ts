/**
 * Publica el menú nativo del bot (setMyCommands) a partir de la lista canónica
 * `scripts/telegram-bot-commands.shared.mjs`. No registra el token en logs.
 */
// @ts-ignore -- fuente canónica del menú (mjs compartido con los scripts)
import { TELEGRAM_BOT_COMMANDS } from '../../scripts/telegram-bot-commands.shared.mjs';

export type ComandoBotTelegram = { command: string; description: string };

export type TelegramBotCall = (
  method: string,
  body: Record<string, unknown>,
) => Promise<unknown>;

export type ResultadoPublicarMenuComandos =
  | { ok: true; actualizado: boolean; comandos: number }
  | { ok: false; error: string };

const SCOPE_DEFAULT = { type: 'default' } as const;

export function sanitizarTextoConToken(texto: string, token: string | null | undefined): string {
  const t = String(token ?? '').trim();
  if (!t) return texto;
  return texto.split(t).join('[redacted]');
}

export function normalizarComandosBot(raw: unknown): ComandoBotTelegram[] {
  if (!Array.isArray(raw)) return [];
  const out: ComandoBotTelegram[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const command = String((item as { command?: unknown }).command ?? '')
      .trim()
      .toLowerCase();
    const description = String((item as { description?: unknown }).description ?? '').trim();
    if (!command) continue;
    out.push({ command, description });
  }
  return out;
}

export function menusComandosIguales(
  a: ComandoBotTelegram[] | unknown,
  b: ComandoBotTelegram[] | unknown,
): boolean {
  const na = normalizarComandosBot(a);
  const nb = normalizarComandosBot(b);
  if (na.length !== nb.length) return false;
  return na.every(
    (c, i) => c.command === nb[i]?.command && c.description === nb[i]?.description,
  );
}

export function comandosMenuCanonico(): ComandoBotTelegram[] {
  return normalizarComandosBot(TELEGRAM_BOT_COMMANDS);
}

function crearTelegramCall(token: string): TelegramBotCall {
  return async (method, body) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      result?: unknown;
      description?: string;
    };
    if (!json.ok) {
      throw new Error(
        sanitizarTextoConToken(json.description ?? `Telegram ${method} falló`, token),
      );
    }
    return json.result;
  };
}

/**
 * Compara getMyCommands (scope default) con la lista canónica y solo llama
 * setMyCommands si hay diferencias. No toca menús por chat (depositario/comprador).
 */
export async function publicarMenuComandosTelegram(opts?: {
  token?: string | null;
  commands?: ComandoBotTelegram[];
  telegramCall?: TelegramBotCall;
}): Promise<ResultadoPublicarMenuComandos> {
  const commands = normalizarComandosBot(opts?.commands ?? TELEGRAM_BOT_COMMANDS);
  const token = (opts?.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const call = opts?.telegramCall ?? (token ? crearTelegramCall(token) : null);
  if (!call) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' };
  }

  try {
    const actuales = normalizarComandosBot(
      await call('getMyCommands', { scope: SCOPE_DEFAULT }),
    );
    if (menusComandosIguales(actuales, commands)) {
      return { ok: true, actualizado: false, comandos: commands.length };
    }
    await call('setMyCommands', { commands, scope: SCOPE_DEFAULT });
    return { ok: true, actualizado: true, comandos: commands.length };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e ?? 'Error Telegram');
    return { ok: false, error: sanitizarTextoConToken(raw, token).slice(0, 300) };
  }
}
