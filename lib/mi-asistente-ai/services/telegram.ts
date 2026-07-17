import { getAsistenteBotToken } from '@/lib/mi-asistente-ai/config/env';

const TELEGRAM_API = 'https://api.telegram.org';

export async function asistenteApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getAsistenteBotToken();
  if (!token) throw new Error('MI_ASISTENTE_AI_BOT_TOKEN no configurado');

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(json.description ?? `Asistente Telegram ${method} falló`);
  }
  return json.result as T;
}

export type AsistenteMessageExtra = {
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: unknown;
  plain?: boolean;
};

export async function sendAsistenteMessage(
  chatId: string | number,
  text: string,
  extra?: AsistenteMessageExtra,
): Promise<number> {
  const { plain, parse_mode, ...rest } = extra ?? {};
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...rest,
  };
  if (!plain) {
    body.parse_mode = parse_mode ?? 'HTML';
  }
  try {
    const result = await asistenteApi<{ message_id: number }>('sendMessage', body);
    return result.message_id;
  } catch (err) {
    if (!plain && body.parse_mode) {
      const fallback = { ...body };
      delete fallback.parse_mode;
      const result = await asistenteApi<{ message_id: number }>('sendMessage', fallback);
      return result.message_id;
    }
    throw err;
  }
}

export async function answerAsistenteCallback(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  try {
    await asistenteApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text: text.slice(0, 200) } : {}),
      show_alert: showAlert,
    });
  } catch (e) {
    console.warn('[mi-asistente-ai] answerCallbackQuery:', e);
  }
}

export async function downloadAsistenteFile(fileId: string): Promise<{
  buffer: Buffer;
  filePath: string;
}> {
  const token = getAsistenteBotToken();
  if (!token) throw new Error('MI_ASISTENTE_AI_BOT_TOKEN no configurado');

  const file = await asistenteApi<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!file.file_path) throw new Error('Telegram no devolvió file_path');

  const url = `${TELEGRAM_API}/file/bot${token}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (${res.status})`);
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), filePath: file.file_path };
}

export const ASISTENTE_BOT_COMMANDS = [
  { command: 'start', description: 'Iniciar el asistente' },
  { command: 'ayuda', description: 'Cómo usar el bot' },
  { command: 'reset', description: 'Borrar historial de conversación' },
  { command: 'storage', description: 'Elegir dónde guardar archivos' },
] as const;
