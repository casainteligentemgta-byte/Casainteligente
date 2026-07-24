import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { applyOwnerFilter, assertAgendaOwner } from '@/lib/agenda/owner';
import type { AgendaOwner, CategoriaFechaEspecial, SpecialDate } from '@/types/agenda';

function getSupabase() {
  return createSupabaseAdminClient();
}

export async function listSpecialDates(
  owner: AgendaOwner,
  filters?: { categoria?: CategoriaFechaEspecial; mes?: number },
): Promise<SpecialDate[]> {
  assertAgendaOwner(owner);

  let query = applyOwnerFilter(getSupabase().from('special_dates').select('*'), owner);

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

  let query = applyOwnerFilter(
    getSupabase().from('special_dates').delete(),
    owner,
  ).eq('id', id);

  const { error } = await query;
  if (error) throw new Error(error.message);
}
