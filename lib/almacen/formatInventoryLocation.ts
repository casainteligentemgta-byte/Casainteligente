import type { SupabaseClient } from '@supabase/supabase-js';

export type DepositRow = {
  id: string;
  name: string;
  locality: string | null;
};

export type FurnitureRow = {
  id: string;
  deposit_id: string;
  name: string;
};

export function formatInventoryLocationLabel(
  item: {
    location?: string | null;
    deposit_id?: string | null;
    furniture_id?: string | null;
    shelf_number?: number | null;
  },
  depositsById: Map<string, DepositRow>,
  furnitureById: Map<string, FurnitureRow>
): string {
  const parts: string[] = [];
  const dep = item.deposit_id ? depositsById.get(item.deposit_id) : undefined;
  if (dep) {
    const depLabel = dep.locality ? `${dep.name} (${dep.locality})` : dep.name;
    parts.push(depLabel);
  }
  const fur = item.furniture_id ? furnitureById.get(item.furniture_id) : undefined;
  if (fur) {
    const shelf =
      item.shelf_number != null && item.shelf_number > 0
        ? ` · Repisa ${item.shelf_number}`
        : '';
    parts.push(`${fur.name}${shelf}`);
  }
  const note = item.location?.trim();
  if (note) parts.push(note);
  if (parts.length === 0) return 'Sin ubicación asignada';
  return parts.join(' — ');
}

export async function fetchDefaultDepositId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from('inventory_deposits')
    .select('id,is_default')
    .order('is_default', { ascending: false })
    .order('name')
    .limit(20);

  if (error || !data?.length) return null;
  const rows = data as { id: string; is_default?: boolean }[];
  const def = rows.find((r) => r.is_default);
  return def?.id ?? rows[0]?.id ?? null;
}
