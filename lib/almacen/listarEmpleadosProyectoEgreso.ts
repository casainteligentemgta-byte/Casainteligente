import type { SupabaseClient } from '@supabase/supabase-js';

export type EmpleadoEgresoOption = {
  id: string;
  nombre_completo: string;
  oficio: string | null;
};

/** Obreros del proyecto: cuadrilla obra + asignados por proyecto_modulo_id. */
export async function listarEmpleadosProyectoEgreso(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<EmpleadoEgresoOption[]> {
  const pid = proyectoId.trim();
  if (!pid) return [];

  const [{ data: links }, { data: modEmps }] = await Promise.all([
    supabase.from('ci_obra_empleados').select('empleado_id').eq('obra_id', pid),
    supabase
      .from('ci_empleados')
      .select('id, nombre_completo, cargo_nombre')
      .eq('proyecto_modulo_id', pid)
      .order('nombre_completo'),
  ]);

  const ids = new Set<string>();
  for (const r of modEmps ?? []) ids.add(String((r as { id: string }).id));
  for (const r of links ?? []) {
    const eid = String((r as { empleado_id?: string }).empleado_id ?? '').trim();
    if (eid) ids.add(eid);
  }

  if (!ids.size) return [];

  const { data: empleados, error } = await supabase
    .from('ci_empleados')
    .select('id, nombre_completo, cargo_nombre')
    .in('id', Array.from(ids).slice(0, 200))
    .order('nombre_completo');

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (empleados ?? []).map((e) => ({
    id: String(e.id),
    nombre_completo: String(e.nombre_completo ?? 'Sin nombre').trim() || 'Sin nombre',
    oficio: e.cargo_nombre != null ? String(e.cargo_nombre).trim() || null : null,
  }));
}
