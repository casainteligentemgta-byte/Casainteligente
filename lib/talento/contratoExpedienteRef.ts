import type { SupabaseClient } from '@supabase/supabase-js';

/** Referencia tipo AÑO-NNNN según contratos del empleado en la obra/proyecto vinculada. */
export async function construirExpedienteRefPorEmpleado(supabase: SupabaseClient, empleadoId: string): Promise<string> {
  const nowYear = new Date().getFullYear();
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at,obra_id,proyecto_id')
    .eq('empleado_id', empleadoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const c = ctr as
    | { id: string; created_at?: string | null; obra_id?: string | null; proyecto_id?: string | null }
    | null;
  if (!c) return `${nowYear}-0001`;

  const sitioId = String(c.obra_id ?? c.proyecto_id ?? '').trim();
  const createdAt = String(c.created_at ?? '').trim();
  const year = createdAt ? new Date(createdAt).getFullYear() : nowYear;
  if (!sitioId || !Number.isFinite(year)) return `${nowYear}-0001`;

  const { data: rows } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at')
    .or(`obra_id.eq.${sitioId},proyecto_id.eq.${sitioId}`);

  const sameYear = ((rows ?? []) as Array<{ id?: string; created_at?: string | null }>)
    .filter((r) => {
      const d = new Date(String(r.created_at ?? ''));
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime());

  const idx = sameYear.findIndex((r) => String(r.id ?? '') === c.id);
  const seq = String(idx >= 0 ? idx + 1 : sameYear.length || 1).padStart(4, '0');
  return `${year}-${seq}`;
}
