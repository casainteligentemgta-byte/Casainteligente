import type { SupabaseClient } from '@supabase/supabase-js';

export type TareaCronogramaOption = {
  id: string;
  nombre_tarea: string;
  codigo_partida: string | null;
  partida_id: string | null;
};

/** Tareas Gantt del proyecto; opcionalmente filtradas por partida Lulo. */
export async function listarTareasCronogramaPartida(
  supabase: SupabaseClient,
  params: { proyectoId: string; ciPresupuestoPartidaId?: string | null },
): Promise<TareaCronogramaOption[]> {
  const pid = params.proyectoId.trim();
  if (!pid) return [];

  let q = supabase
    .from('cronograma_tareas')
    .select('id, nombre_tarea, codigo_partida, partida_id')
    .eq('proyecto_id', pid)
    .order('orden')
    .order('fecha_inicio_planificada')
    .limit(80);

  const partidaId = params.ciPresupuestoPartidaId?.trim();
  if (partidaId) {
    q = q.eq('partida_id', partidaId);
  }

  const { data, error } = await q;
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? []).map((t) => ({
    id: String(t.id),
    nombre_tarea: String(t.nombre_tarea ?? 'Actividad').trim(),
    codigo_partida: t.codigo_partida != null ? String(t.codigo_partida).trim() || null : null,
    partida_id: t.partida_id != null ? String(t.partida_id) : null,
  }));
}
