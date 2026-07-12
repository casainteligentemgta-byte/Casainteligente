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

export function isChatAllowed(chatId: string | number): boolean {
  const allowed = getTelegramAllowedChatIds();
  if (allowed.size === 0) return true;
  return allowed.has(String(chatId));
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  extra?: { parse_mode?: 'HTML' | 'Markdown' },
): Promise<void> {
  const token = getTelegramBotToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: extra?.parse_mode,
    }),
  });

  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) {
    throw new Error(json.description ?? 'Telegram sendMessage falló');
  }
}

export function verifyTelegramWebhookSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  return req.headers.get('x-telegram-bot-api-secret-token') === expected;
}
