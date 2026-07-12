const TELEGRAM_API = 'https://api.telegram.org';

export function getTelegramLogBotToken(): string | null {
  return process.env.TELEGRAM_LOG_BOT_TOKEN?.trim() || null;
}

export function getTelegramLogChatId(): string | null {
  return process.env.TELEGRAM_LOG_CHAT_ID?.trim() || null;
}

export function isLogBotConfigured(): boolean {
  return Boolean(getTelegramLogBotToken() && getTelegramLogChatId());
}

export async function logBotApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getTelegramLogBotToken();
  if (!token) throw new Error('TELEGRAM_LOG_BOT_TOKEN no configurado');

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(json.description ?? `Telegram Log Bot ${method} falló`);
  }
  return json.result as T;
}

export type LogBotMessageExtra = {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: unknown;
};

export async function sendLogBotMessage(
  chatId: string | number,
  text: string,
  extra?: LogBotMessageExtra,
): Promise<number> {
  const result = await logBotApi<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: extra?.parse_mode ?? 'Markdown',
    disable_web_page_preview: false,
    ...extra,
  });
  return result.message_id;
}

export async function editLogBotMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  extra?: LogBotMessageExtra,
): Promise<void> {
  try {
    await logBotApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: extra?.parse_mode ?? 'Markdown',
      disable_web_page_preview: false,
      ...extra,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/message is not modified/i.test(msg)) return;
    throw err;
  }
}

export async function answerLogBotCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  try {
    await logBotApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text: text.slice(0, 200) } : {}),
      show_alert: showAlert,
    });
  } catch (e) {
    console.warn('[logBot] answerCallbackQuery:', callbackQueryId, e);
  }
}
