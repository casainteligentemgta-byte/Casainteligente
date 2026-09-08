import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { applyOwnerFilter, assertAgendaOwner } from '@/lib/agenda/owner';
import type { AgendaOwner, CategoriaFechaEspecial, SpecialDate } from '@/types/agenda';

function getSupabase() {
  return createSupabaseAdminClient();
}

/** Query suelta: evita TS2589 con la cadena tipada de Supabase. */
type LooseSpecialDatesQuery = {
  eq: (column: string, value: string) => LooseSpecialDatesQuery;
  gte: (column: string, value: string) => LooseSpecialDatesQuery;
  lte: (column: string, value: string) => LooseSpecialDatesQuery;
  order: (
    column: string,
    opts: { ascending: boolean },
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

export async function listSpecialDates(
  owner: AgendaOwner,
  filters?: { categoria?: CategoriaFechaEspecial; mes?: number },
): Promise<SpecialDate[]> {
  assertAgendaOwner(owner);

  let query = applyOwnerFilter(
    getSupabase().from('special_dates').select('*') as unknown as {
      eq: (column: string, value: string) => LooseSpecialDatesQuery;
    },
    owner,
  ) as LooseSpecialDatesQuery;

  if (filters?.categoria) {
    query = query.eq('category', filters.categoria);
  }

  if (filters?.mes !== undefined) {
    const year = new Date().getFullYear();
    const month = String(filters.mes).padStart(2, '0');
    const lastDay = new Date(year, filters.mes, 0).getDate();
    query = query
      .gte('event_date', `${year}-${month}-01`)
      .lte('event_date', `${year}-${month}-${String(lastDay).padStart(2, '0')}`);
  }

  const { data, error } = await query.order('event_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SpecialDate[];
}

export async function deleteSpecialDate(owner: AgendaOwner, id: string): Promise<void> {
  assertAgendaOwner(owner);

  let del = getSupabase().from('special_dates').delete().eq('id', id);
  if (owner.userId) {
    del = del.eq('user_id', owner.userId);
  } else if (owner.telegramChatId) {
    del = del.eq('telegram_chat_id', owner.telegramChatId);
  }
  const { error } = await del;
  if (error) throw new Error(error.message);
}
