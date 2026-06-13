import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';

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
