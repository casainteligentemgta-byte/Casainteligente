import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import { filtrarQueryCatalogoEntidad } from '@/lib/almacen/catalogoEntidad';
import { escapeIlike, patronIlike } from '@/lib/contabilidad/comprasQueryFiltros';
import { listarMaterialesObraRecepcion } from '@/lib/almacen/listarMaterialesObraRecepcion';

function mapRow(row: {
  id: string;
  name?: string | null;
  sap_code?: string | null;
  unit?: string | null;
}): MaterialCampoOpcion {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Material').trim() || 'Material',
    sap_code: row.sap_code?.trim() || null,
    unit: String(row.unit ?? 'UND').trim() || 'UND',
  };
}

export type BuscarMaterialesCatalogoOpts = {
  limit?: number;
  /** Catálogo de la entidad (patrono). Si se omite, búsqueda global (legacy). */
  entidadId?: string | null;
  proyectoId?: string | null;
};

/** Búsqueda por nombre o SKU en global_inventory (mín. 2 caracteres). */
export async function buscarMaterialesCatalogo(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<MaterialCampoOpcion[]> {
  const t = term.trim().replace(/%/g, '');
  if (t.length < 2) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 12, 1), 24);
  let query = supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .or(`name.ilike.%${t}%,sap_code.ilike.%${t}%`)
    .order('name')
    .limit(limit);

  query = filtrarQueryCatalogoEntidad(query, opts?.entidadId);

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string }),
  );
}

export function etiquetaMaterialCatalogo(m: MaterialCampoOpcion): string {
  return m.sap_code ? `${m.name} (${m.sap_code})` : m.name;
}

function scoreMaterialFuzzy(term: string, m: MaterialCampoOpcion): number {
  const t = term.toLowerCase();
  const name = m.name.toLowerCase();
  const code = (m.sap_code ?? '').toLowerCase();
  if (!t) return 0;
  if (name === t || code === t) return 100;
  if (name.startsWith(t) || code.startsWith(t)) return 85;
  if (name.split(/\s+/).some((w) => w.startsWith(t))) return 75;
  if (name.includes(t) || code.includes(t)) return 60;
  return 0;
}

/** Búsqueda difusa por nombre o SKU (mín. 3 caracteres, top N por relevancia). */
export async function buscarMaterialesFuzzyCatalogo(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<MaterialCampoOpcion[]> {
  const t = term.trim().replace(/%/g, '');
  if (t.length < 3) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 5, 1), 10);
  const pattern = patronIlike(t);
  if (!pattern) return [];

  let query = supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .or(`name.ilike.${pattern},sap_code.ilike.${pattern}`)
    .order('name')
    .limit(40);

  query = filtrarQueryCatalogoEntidad(query, opts?.entidadId);

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) =>
      mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string }),
    )
    .map((m) => ({ m, score: scoreMaterialFuzzy(t, m) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.m.name.localeCompare(b.m.name, 'es', { sensitivity: 'base' }),
    )
    .slice(0, limit)
    .map((x) => x.m);
}

function coincidePrefijo(m: MaterialCampoOpcion, term: string): boolean {
  const t = term.toLowerCase();
  if (m.name.toLowerCase().startsWith(t)) return true;
  if (m.sap_code?.toLowerCase().startsWith(t)) return true;
  return false;
}

/** Materiales cuyo nombre o SKU empieza por el término (desde 1 letra). */
export async function buscarMaterialesPorPrefijo(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<MaterialCampoOpcion[]> {
  const t = term.trim().replace(/%/g, '');
  if (!t) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 36, 1), 60);
  const byId = new Map<string, MaterialCampoOpcion>();

  const proyectoId = opts?.proyectoId?.trim();
  if (proyectoId) {
    const obra = await listarMaterialesObraRecepcion(supabase, proyectoId);
    for (const m of obra) {
      if (coincidePrefijo(m, t)) byId.set(m.id, m);
    }
  }

  const prefix = `${escapeIlike(t)}%`;
  let query = supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .or(`name.ilike.${prefix},sap_code.ilike.${prefix}`)
    .order('name')
    .limit(limit);

  query = filtrarQueryCatalogoEntidad(query, opts?.entidadId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const m = mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string });
    byId.set(m.id, m);
  }

  return Array.from(byId.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, limit);
}
