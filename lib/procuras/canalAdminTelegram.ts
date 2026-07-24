import { getTelegramAllowedChatIds } from '@/lib/telegram/botApi';

/** Canal/grupo de administración para alertas de procura y almacén. */
export function idCanalAdminTelegram(): string | null {
  const admin = process.env.TELEGRAM_ADMIN_CHANNEL_ID?.trim();
  if (admin) return admin;
  const almacen = process.env.TELEGRAM_ALMACEN_CHAT_IDS?.trim();
  if (almacen) {
    const first = almacen.split(/[,;\s]+/).map((s) => s.trim()).find(Boolean);
    if (first) return first;
  }
  const allowed = getTelegramAllowedChatIds();
  if (allowed.size === 1) return Array.from(allowed)[0] ?? null;
  return null;
}

export function esChatCanalAdminTelegram(chatId: string | number): boolean {
  const canal = idCanalAdminTelegram();
  return Boolean(canal && String(chatId) === canal);
}
