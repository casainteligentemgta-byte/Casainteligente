import type { SupabaseClient } from '@supabase/supabase-js';

export type EntidadRow = { id: string; nombre: string; rif: string | null };
export type ProyectoRow = { id: string; nombre: string; entidad_id: string | null };
export type PartidaRow = {
  id: string;
  codigo_partida: string;
  descripcion: string;
  proyecto_id: string;
};

export type InventarioClasificacionValue = {
  entidad_id: string | null;
  proyecto_id: string | null;
  presupuesto_partida_id: string | null;
};

export async function loadEntidades(supabase: SupabaseClient): Promise<EntidadRow[]> {
  const { data, error } = await supabase
    .from('ci_entidades')
    .select('id,nombre,rif')
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as EntidadRow[];
}

export async function loadProyectos(supabase: SupabaseClient): Promise<ProyectoRow[]> {
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id,nombre,entidad_id')
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as ProyectoRow[];
}

export async function loadPartidasPorProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PartidaRow[]> {
  if (!proyectoId) return [];
  const { data, error } = await supabase
    .from('ci_presupuesto_partidas')
    .select('id,codigo_partida,descripcion,proyecto_id')
    .eq('proyecto_id', proyectoId)
    .in('origen', ['lulo_csv', 'lulo_mdb'])
    .order('codigo_partida');
  if (error) throw error;
  return (data ?? []) as PartidaRow[];
}

export function labelPartida(p: PartidaRow): string {
  const cod = p.codigo_partida?.trim();
  const desc = p.descripcion?.trim();
  if (cod && desc) return `${cod} — ${desc}`;
  return cod || desc || p.id.slice(0, 8);
}

export function filtrarProyectosPorEntidad(
  proyectos: ProyectoRow[],
  entidadId: string | null,
): ProyectoRow[] {
  if (!entidadId) return proyectos;
  return proyectos.filter((p) => p.entidad_id === entidadId);
}
