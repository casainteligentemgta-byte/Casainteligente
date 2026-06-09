import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import { escapeIlike } from '@/lib/contabilidad/comprasQueryFiltros';
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

/** Búsqueda por nombre o SKU en global_inventory (mín. 2 caracteres). */
export async function buscarMaterialesCatalogo(
  supabase: SupabaseClient,
  term: string,
  opts?: { limit?: number },
): Promise<MaterialCampoOpcion[]> {
  const t = term.trim().replace(/%/g, '');
  if (t.length < 2) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 12, 1), 24);
  const { data, error } = await supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .or(`name.ilike.%${t}%,sap_code.ilike.%${t}%`)
    .order('name')
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string }),
  );
}

export function etiquetaMaterialCatalogo(m: MaterialCampoOpcion): string {
  return m.sap_code ? `${m.name} (${m.sap_code})` : m.name;
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
  opts?: { limit?: number; proyectoId?: string | null },
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
  const { data, error } = await supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .or(`name.ilike.${prefix},sap_code.ilike.${prefix}`)
    .order('name')
    .limit(limit);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const m = mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string });
    byId.set(m.id, m);
  }

  return Array.from(byId.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, limit);
}
