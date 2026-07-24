import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { CATEGORIA_LABELS, type CategoriaFechaEspecial, type SpecialDate } from '@/types/agenda';

function getSupabase() {
  return createSupabaseAdminClient();
}

function isTelegramRecipient(chatId: string | null): chatId is string {
  if (!chatId) return false;
  if (chatId.startsWith('app-')) return false;
  return /^-?\d+$/.test(chatId);
}

function formatEvento(event: SpecialDate): string {
  const cat = CATEGORIA_LABELS[event.category as CategoriaFechaEspecial] ?? event.category;
  const hora = event.event_time ? ` a las ${event.event_time.slice(0, 5)}` : '';
  return `• <b>${event.title}</b> (${cat})${hora}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type ReminderRunResult = {
  dayBeforeSent: number;
  sameDaySent: number;
  errors: string[];
};

export async function sendAgendaReminders(): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { dayBeforeSent: 0, sameDaySent: 0, errors: [] };
  const supabase = getSupabase();
  const today = todayIso();
  const tomorrow = tomorrowIso();

  const { data: dayBeforeRows, error: dayBeforeError } = await supabase
    .from('special_dates')
    .select('*')
    .eq('event_date', tomorrow)
    .is('reminder_day_before_sent_at', null);

  if (dayBeforeError) {
    result.errors.push(dayBeforeError.message);
    return result;
  }

  const { data: sameDayRows, error: sameDayError } = await supabase
    .from('special_dates')
    .select('*')
    .eq('event_date', today)
    .is('reminder_same_day_sent_at', null);

  if (sameDayError) {
    result.errors.push(sameDayError.message);
    return result;
  }

  const byChatDayBefore = new Map<string, SpecialDate[]>();
  for (const row of (dayBeforeRows ?? []) as SpecialDate[]) {
    if (!isTelegramRecipient(row.telegram_chat_id)) continue;
    const list = byChatDayBefore.get(row.telegram_chat_id) ?? [];
    list.push(row);
    byChatDayBefore.set(row.telegram_chat_id, list);
  }

  for (const [chatId, events] of Array.from(byChatDayBefore.entries())) {
    try {
      const lines = events.map(formatEvento).join('\n');
      await sendTelegramMessage(
        chatId,
        `⏰ <b>Recordatorio — mañana</b>\n\n${lines}\n\n<i>Agenda Casa Inteligente</i>`,
        { parse_mode: 'HTML' },
      );
      const ids = events.map((e: SpecialDate) => e.id);
      await supabase
        .from('special_dates')
        .update({ reminder_day_before_sent_at: new Date().toISOString() })
        .in('id', ids);
      result.dayBeforeSent += events.length;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const byChatSameDay = new Map<string, SpecialDate[]>();
  for (const row of (sameDayRows ?? []) as SpecialDate[]) {
    if (!isTelegramRecipient(row.telegram_chat_id)) continue;
    const list = byChatSameDay.get(row.telegram_chat_id) ?? [];
    list.push(row);
    byChatSameDay.set(row.telegram_chat_id, list);
  }

  for (const [chatId, events] of Array.from(byChatSameDay.entries())) {
    try {
      const lines = events.map(formatEvento).join('\n');
      await sendTelegramMessage(
        chatId,
        `📅 <b>Hoy tienes</b>\n\n${lines}\n\n<i>Agenda Casa Inteligente</i>`,
        { parse_mode: 'HTML' },
      );
      const ids = events.map((e: SpecialDate) => e.id);
      await supabase
        .from('special_dates')
        .update({ reminder_same_day_sent_at: new Date().toISOString() })
        .in('id', ids);
      result.sameDaySent += events.length;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}
