import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import { filtrarQueryCatalogoEntidad } from '@/lib/almacen/catalogoEntidad';
import { buscarMaterialPorAlias, buscarMaterialPorAliasAproximado } from '@/lib/almacen/materialAliases';
import { normalizarTextoMaterial, variantesObraMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import { scoreMaterialInteligente } from '@/lib/almacen/scoreMaterialInteligente';
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
  /** Siempre recorre el pool completo (modo corrección ortográfica). */
  forzarSimilitud?: boolean;
};

export type MaterialBusquedaInteligente = {
  material: MaterialCampoOpcion;
  score: number;
  fuente: 'alias' | 'ilike' | 'similitud' | 'obra';
};

export function etiquetaMaterialCatalogo(m: MaterialCampoOpcion): string {
  return m.sap_code ? `${m.name} (${m.sap_code})` : m.name;
}

function mergeResultado(
  map: Map<string, MaterialBusquedaInteligente>,
  material: MaterialCampoOpcion,
  score: number,
  fuente: MaterialBusquedaInteligente['fuente'],
): void {
  const prev = map.get(material.id);
  if (!prev || score > prev.score) {
    map.set(material.id, { material, score, fuente });
  }
}

async function listarPoolCatalogo(
  supabase: SupabaseClient,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<{ materiales: MaterialCampoOpcion[]; obraIds: Set<string> }> {
  const limit = 900;
  const byId = new Map<string, MaterialCampoOpcion>();
  const obraIds = new Set<string>();

  const proyectoId = opts?.proyectoId?.trim();
  if (proyectoId) {
    try {
      const obra = await listarMaterialesObraRecepcion(supabase, proyectoId);
      for (const m of obra) {
        byId.set(m.id, m);
        obraIds.add(m.id);
      }
    } catch {
      /* obra opcional */
    }
  }

  let query = supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .order('name')
    .limit(limit);

  query = filtrarQueryCatalogoEntidad(query, opts?.entidadId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const m = mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string });
    byId.set(m.id, m);
  }

  return { materiales: Array.from(byId.values()), obraIds };
}

async function buscarIlikeCatalogo(
  supabase: SupabaseClient,
  pattern: string,
  termNorm: string,
  map: Map<string, MaterialBusquedaInteligente>,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<void> {
  if (!pattern) return;

  let query = supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .or(`name.ilike.${pattern},sap_code.ilike.${pattern}`)
    .order('name')
    .limit(60);

  query = filtrarQueryCatalogoEntidad(query, opts?.entidadId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const m = mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string });
    const score = scoreMaterialInteligente(termNorm, m);
    if (score > 0) mergeResultado(map, m, score, 'ilike');
  }
}

/** Búsqueda inteligente: alias + ILIKE + similitud (Levenshtein + variantes obra). */
export async function buscarMaterialesInteligenteCatalogo(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<MaterialBusquedaInteligente[]> {
  const t = term.trim().replace(/%/g, '');
  if (t.length < 3) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 5, 1), 10);
  const termNorm = normalizarTextoMaterial(t);
  const map = new Map<string, MaterialBusquedaInteligente>();

  try {
    const aliasHits = await buscarMaterialPorAlias(supabase, t, opts?.entidadId);
    for (const m of aliasHits) mergeResultado(map, m, 100, 'alias');

    const aliasAprox = await buscarMaterialPorAliasAproximado(supabase, t, opts?.entidadId);
    for (const m of aliasAprox) mergeResultado(map, m, 98, 'alias');
  } catch (e) {
    console.warn('[buscarMaterialesInteligenteCatalogo] alias:', e);
  }

  const pattern = patronIlike(t);
  if (pattern) {
    await buscarIlikeCatalogo(supabase, pattern, termNorm, map, opts);

    const variantes = Array.from(
      new Set(
        variantesObraMaterial(termNorm).filter((v) => v.length >= 3 && v !== termNorm),
      ),
    ).slice(0, 6);
    for (const variant of variantes) {
      const varPattern = patronIlike(variant);
      if (!varPattern || varPattern === pattern) continue;
      await buscarIlikeCatalogo(supabase, varPattern, termNorm, map, opts);
    }
  }

  const fuertes = Array.from(map.values()).filter((x) => x.score >= 70);
  if (opts?.forzarSimilitud || fuertes.length < limit) {
    const { materiales: pool, obraIds } = await listarPoolCatalogo(supabase, opts);
    for (const m of pool) {
      let score = scoreMaterialInteligente(termNorm, m);
      if (obraIds.has(m.id)) score = Math.min(100, score + 10);
      if (score >= 62) mergeResultado(map, m, score, obraIds.has(m.id) ? 'obra' : 'similitud');
    }
  }

  return Array.from(map.values())
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.material.name.localeCompare(b.material.name, 'es', { sensitivity: 'base' }),
    )
    .slice(0, limit);
}

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

/** Búsqueda difusa por nombre o SKU (mín. 3 caracteres, top N por relevancia). */
export async function buscarMaterialesFuzzyCatalogo(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<MaterialCampoOpcion[]> {
  const hits = await buscarMaterialesInteligenteCatalogo(supabase, term, opts);
  return hits.map((h) => h.material);
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
