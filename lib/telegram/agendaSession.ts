import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AgendaChatMessage, LlmProvider } from '@/types/agenda';

const MAX_MESSAGES = 24;

function getSupabase() {
  return createSupabaseAdminClient();
}

function normalizeMessages(raw: unknown): AgendaChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is AgendaChatMessage =>
      typeof item === 'object' &&
      item !== null &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.text === 'string' &&
      item.text.trim().length > 0,
  );
}

export async function loadTelegramAgendaHistory(
  chatId: string | number,
): Promise<AgendaChatMessage[]> {
  const { data, error } = await getSupabase()
    .from('telegram_agenda_sessions')
    .select('messages')
    .eq('telegram_chat_id', String(chatId))
    .maybeSingle();

  if (error) throw new Error(`Error al cargar historial: ${error.message}`);
  return normalizeMessages(data?.messages);
}

export async function saveTelegramAgendaHistory(
  chatId: string | number,
  messages: AgendaChatMessage[],
  provider?: LlmProvider,
): Promise<void> {
  const trimmed = messages.slice(-MAX_MESSAGES);

  const { error } = await getSupabase().from('telegram_agenda_sessions').upsert(
    {
      telegram_chat_id: String(chatId),
      messages: trimmed,
      provider: provider ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_chat_id' },
  );

  if (error) throw new Error(`Error al guardar historial: ${error.message}`);
}

export async function clearTelegramAgendaHistory(chatId: string | number): Promise<void> {
  const { error } = await getSupabase()
    .from('telegram_agenda_sessions')
    .delete()
    .eq('telegram_chat_id', String(chatId));

  if (error) throw new Error(`Error al limpiar historial: ${error.message}`);
}

export function getTelegramHistoryLimit(): number {
  return MAX_MESSAGES;
}
