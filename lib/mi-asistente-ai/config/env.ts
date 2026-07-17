/** Variables de entorno del bot asistente AI (separado del bot operativo). */

export function getAsistenteBotToken(): string | null {
  return process.env.MI_ASISTENTE_AI_BOT_TOKEN?.trim() || null;
}

export function getAsistenteBotUsername(): string | null {
  const u = process.env.MI_ASISTENTE_AI_BOT_USERNAME?.trim();
  return u ? u.replace(/^@/, '') : null;
}

export function getAsistenteWebhookSecret(): string | null {
  return process.env.MI_ASISTENTE_AI_WEBHOOK_SECRET?.trim() || null;
}

export function getAsistenteAllowedChatIds(): Set<string> {
  const raw = process.env.MI_ASISTENTE_AI_ALLOWED_CHAT_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAsistenteChatAllowed(chatId: string | number): boolean {
  const allowed = getAsistenteAllowedChatIds();
  if (allowed.size === 0) return true;
  return allowed.has(String(chatId));
}

export function isAsistenteConfigured(): boolean {
  return Boolean(getAsistenteBotToken());
}

/** Proveedor de almacenamiento por defecto: drive | onedrive | icloud | supabase */
export type StorageProviderId = 'drive' | 'onedrive' | 'icloud' | 'supabase';

export function getDefaultStorageProvider(): StorageProviderId {
  const raw = (process.env.MI_ASISTENTE_AI_STORAGE_PROVIDER || 'supabase').trim().toLowerCase();
  if (raw === 'drive' || raw === 'onedrive' || raw === 'icloud' || raw === 'supabase') {
    return raw;
  }
  return 'supabase';
}

export function getAsistenteGeminiModel(): string {
  return (
    process.env.MI_ASISTENTE_AI_GEMINI_MODEL?.trim() ||
    process.env.GEMINI_PROCUREMENT_MODEL?.trim() ||
    'gemini-2.5-flash'
  );
}
