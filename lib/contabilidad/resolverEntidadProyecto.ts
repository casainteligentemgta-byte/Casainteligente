import type { SupabaseClient } from '@supabase/supabase-js';

/** Entidad de trabajo asociada a un proyecto (ci_proyectos.entidad_id). */
export async function resolverEntidadIdDesdeProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<string | null> {
  const id = proyectoId.trim();
  if (!id) return null;
  const { data } = await supabase
    .from('ci_proyectos')
    .select('entidad_id')
    .eq('id', id)
    .maybeSingle();
  return data?.entidad_id ? String(data.entidad_id) : null;
}
