const TELEGRAM_API = 'https://api.telegram.org';

export function getTelegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function getTelegramAllowedChatIds(): Set<string> {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Solo lista de env. Preferir {@link isChatAllowedAsync} (env + BD). */
export function isChatAllowed(chatId: string | number): boolean {
  const allowed = getTelegramAllowedChatIds();
  if (allowed.size === 0) return true;
  return allowed.has(String(chatId));
}

export async function telegramApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getTelegramBotToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(json.description ?? `Telegram ${method} falló`);
  }
  return json.result as T;
}

export type TelegramMessageExtra = {
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: unknown;
  /** Sin parse_mode (texto plano, sin etiquetas HTML). */
  plain?: boolean;
  /** Etiqueta del rol destinatario (modo pruebas TELEGRAM_PRUEBAS_REDIRECT). */
  rolDestinatario?: string;
};

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  extra?: TelegramMessageExtra,
): Promise<void> {
  await sendTelegramMessageWithId(chatId, text, extra);
}

/** Envía mensaje y devuelve message_id (para editar progreso después). */
export async function sendTelegramMessageWithId(
  chatId: string | number,
  text: string,
  extra?: TelegramMessageExtra,
): Promise<number> {
  const { prepararEnvioPruebasTelegram } = await import('@/lib/telegram/enrutamientoPruebasTelegram');
  const enrutado = await prepararEnvioPruebasTelegram(chatId, text, extra);

  const { plain, parse_mode, rolDestinatario: _rol, ...rest } = extra ?? {};
  const body: Record<string, unknown> = {
    chat_id: enrutado.chatId,
    text: enrutado.text,
    disable_web_page_preview: false,
    ...rest,
  };
  if (!plain) {
    body.parse_mode = parse_mode ?? 'HTML';
  }
  const result = await telegramApi<{ message_id: number }>('sendMessage', body);

  void import('@/lib/telegram/espejoSalidaLogBot').then(({ espejarSalidaTelegramLogAsync }) => {
    espejarSalidaTelegramLogAsync({
      chatIdDestinoOriginal: chatId,
      textoEnviado: enrutado.text,
      rolDestinatario: extra?.rolDestinatario,
      plain: extra?.plain,
      reply_markup: extra?.reply_markup,
    });
  });

  return result.message_id;
}

export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  extra?: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: unknown },
): Promise<void> {
  try {
    await telegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: extra?.parse_mode ?? 'HTML',
      disable_web_page_preview: false,
      ...extra,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/message is not modified/i.test(msg)) return;
    throw err;
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  try {
    await telegramApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text: text.slice(0, 200) } : {}),
      show_alert: showAlert,
    });
  } catch (e) {
    console.warn('[telegram] answerCallbackQuery:', callbackQueryId, e);
  }
}

/** Alias en español (mismo comportamiento que sendTelegramMessage). */
export const enviarMensajeTelegram = sendTelegramMessage;

export type TelegramFile = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
};

export async function downloadTelegramFile(fileId: string): Promise<{
  buffer: Buffer;
  filePath: string;
}> {
  const token = getTelegramBotToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');

  const fileMeta = await telegramApi<{ file_path: string }>('getFile', { file_id: fileId });
  const url = `${TELEGRAM_API}/file/bot${token}/${fileMeta.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo descargar el archivo de Telegram');
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, filePath: fileMeta.file_path };
}

export function mimeFromTelegramPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'wav') return 'audio/wav';
  return 'image/jpeg';
}
