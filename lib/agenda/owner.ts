import type { AgendaOwner } from '@/types/agenda';

export function assertAgendaOwner(owner: AgendaOwner): void {
  if (!owner.userId?.trim() && !owner.telegramChatId?.trim()) {
    throw new Error('Se requiere userId o telegramChatId para la agenda.');
  }
}

export function ownerFromUserId(userId: string): AgendaOwner {
  return { userId: userId.trim() };
}

export function ownerFromTelegramChat(chatId: string | number): AgendaOwner {
  return { telegramChatId: String(chatId) };
}

export function ownerFromAppSession(sessionId: string): AgendaOwner {
  return { telegramChatId: `app-${sessionId.trim()}` };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyOwnerFilter(query: any, owner: AgendaOwner) {
  if (owner.userId) return query.eq('user_id', owner.userId);
  if (owner.telegramChatId) return query.eq('telegram_chat_id', owner.telegramChatId);
  return query;
}

export function ownerInsertPayload(owner: AgendaOwner): {
  user_id: string | null;
  telegram_chat_id: string | null;
} {
  return {
    user_id: owner.userId ?? null,
    telegram_chat_id: owner.telegramChatId ?? null,
  };
}
