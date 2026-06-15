import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import { ratioSimilitudLevenshtein } from '@/lib/almacen/scoreMaterialInteligente';

function mapMaterial(row: {
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

/** Busca materiales por alias aprendido o manual (tabla ci_material_aliases). */
export async function buscarMaterialPorAlias(
  supabase: SupabaseClient,
  term: string,
  entidadId?: string | null,
): Promise<MaterialCampoOpcion[]> {
  const aliasNorm = normalizarTextoMaterial(term);
  if (aliasNorm.length < 2) return [];

  const eid = entidadId?.trim();
  if (!eid) return [];

  let query = supabase
    .from('ci_material_aliases')
    .select('material_id')
    .eq('entidad_id', eid)
    .eq('alias_norm', aliasNorm)
    .limit(5);

  const { data: aliasRows, error: aliasErr } = await query;
  if (aliasErr) {
    if (/ci_material_aliases|42P01|schema cache/i.test(aliasErr.message)) return [];
    throw new Error(aliasErr.message);
  }

  const ids = Array.from(new Set((aliasRows ?? []).map((r) => String(r.material_id)).filter(Boolean)));
  if (!ids.length) return [];

  const { data: mats, error: matErr } = await supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .in('id', ids);

  if (matErr) throw new Error(matErr.message);
  return (mats ?? []).map((row) =>
    mapMaterial(row as { id: string; name?: string; sap_code?: string; unit?: string }),
  );
}

const MAX_DISTANCIA_ALIAS_APROX = 2;
const SIMILITUD_MIN_ALIAS_APROX = 78;

/** Alias con typo cercano (cabiya → alias cabilla ya aprendido, o caviya ≈ cabiya). */
export async function buscarMaterialPorAliasAproximado(
  supabase: SupabaseClient,
  term: string,
  entidadId?: string | null,
): Promise<MaterialCampoOpcion[]> {
  const termNorm = normalizarTextoMaterial(term);
  if (termNorm.length < 3) return [];

  const eid = entidadId?.trim();
  if (!eid) return [];

  const exactos = await buscarMaterialPorAlias(supabase, term, eid);
  if (exactos.length) return exactos;

  const { data: aliasRows, error: aliasErr } = await supabase
    .from('ci_material_aliases')
    .select('alias_norm, material_id')
    .eq('entidad_id', eid)
    .limit(400);

  if (aliasErr) {
    if (/ci_material_aliases|42P01|schema cache/i.test(aliasErr.message)) return [];
    throw new Error(aliasErr.message);
  }

  const hits = new Map<string, number>();
  for (const row of aliasRows ?? []) {
    const aliasNorm = String(row.alias_norm ?? '').trim();
    const materialId = String(row.material_id ?? '').trim();
    if (!aliasNorm || !materialId) continue;
    if (aliasNorm === termNorm) {
      hits.set(materialId, 100);
      continue;
    }
    const sim = ratioSimilitudLevenshtein(termNorm, aliasNorm);
    const dist = Math.abs(termNorm.length - aliasNorm.length);
    if (sim >= SIMILITUD_MIN_ALIAS_APROX && dist <= MAX_DISTANCIA_ALIAS_APROX) {
      const prev = hits.get(materialId) ?? 0;
      hits.set(materialId, Math.max(prev, Math.round(sim)));
    }
  }

  if (!hits.size) return [];

  const ids = Array.from(hits.keys());
  const { data: mats, error: matErr } = await supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .in('id', ids);

  if (matErr) throw new Error(matErr.message);

  return (mats ?? [])
    .map((row) => mapMaterial(row as { id: string; name?: string; sap_code?: string; unit?: string }))
    .sort((a, b) => (hits.get(b.id) ?? 0) - (hits.get(a.id) ?? 0));
}

/**
 * Guarda alias cuando el obrero escribió distinto al nombre oficial pero eligió el material correcto.
 * Falla en silencio si la migración 242 no está aplicada.
 */
export async function aprenderAliasMaterial(
  supabase: SupabaseClient,
  opts: {
    entidadId: string | null | undefined;
    alias: string;
    materialId: string;
    materialName: string;
  },
): Promise<void> {
  const eid = opts.entidadId?.trim();
  const aliasNorm = normalizarTextoMaterial(opts.alias);
  const nameNorm = normalizarTextoMaterial(opts.materialName);

  if (!eid || aliasNorm.length < 3 || !opts.materialId?.trim()) return;
  if (aliasNorm === nameNorm) return;
  if (nameNorm.includes(aliasNorm) && aliasNorm.length >= nameNorm.length - 2) return;

  const { error } = await supabase.from('ci_material_aliases').upsert(
    {
      entidad_id: eid,
      alias_norm: aliasNorm,
      material_id: opts.materialId.trim(),
    },
    { onConflict: 'entidad_id,alias_norm' },
  );

  if (error && !/ci_material_aliases|42P01|schema cache/i.test(error.message)) {
    console.warn('[aprenderAliasMaterial]', error.message);
  }
}
