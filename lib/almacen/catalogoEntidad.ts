import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';

export type CatalogoEntidadRow = {
  entidad_id: string;
  sap_prefijo: string;
  created_at?: string;
};

/** Resuelve entidad del catálogo: explícita → proyecto → null. */
export async function resolverEntidadIdCatalogo(
  supabase: SupabaseClient,
  opts?: { entidadId?: string | null; proyectoId?: string | null },
): Promise<string | null> {
  const direct = opts?.entidadId?.trim();
  if (direct) return direct;
  const proyectoId = opts?.proyectoId?.trim();
  if (!proyectoId) return null;
  return resolverEntidadIdDesdeProyecto(supabase, proyectoId);
}

/** Aplica filtro estricto por catálogo de entidad en consultas PostgREST. */
export function filtrarQueryCatalogoEntidad<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  entidadId: string | null | undefined,
): T {
  const eid = entidadId?.trim();
  if (!eid) return query;
  return query.eq('entidad_id', eid);
}

export async function obtenerCatalogoEntidad(
  supabase: SupabaseClient,
  entidadId: string,
): Promise<CatalogoEntidadRow | null> {
  const id = entidadId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from('ci_catalogos_entidad')
    .select('entidad_id,sap_prefijo,created_at')
    .eq('entidad_id', id)
    .maybeSingle();
  if (error && !/ci_catalogos_entidad|42P01|schema cache/i.test(error.message)) {
    throw new Error(error.message);
  }
  if (!data) return null;
  return data as CatalogoEntidadRow;
}

/** Indica si el material pertenece al catálogo de la entidad (o sin filtro si no hay entidad). */
export function materialPerteneceCatalogoEntidad(
  material: { entidad_id?: string | null },
  entidadId: string | null | undefined,
): boolean {
  const eid = entidadId?.trim();
  if (!eid) return true;
  return String(material.entidad_id ?? '').trim() === eid;
}
