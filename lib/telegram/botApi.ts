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

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  extra?: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: unknown },
): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: extra?.parse_mode ?? 'HTML',
    disable_web_page_preview: false,
    ...extra,
  });
}

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
  return 'image/jpeg';
}
