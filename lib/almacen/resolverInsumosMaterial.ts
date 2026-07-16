import type { SupabaseClient } from '@supabase/supabase-js';
import { matchProcurementMaterialId } from '@/lib/almacen/matchProcurementMaterial';

type InsumoRow = { id: string; codigo: string; descripcion: string };

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resuelve insumos Lulo vinculados a un material de `global_inventory`
 * (código SAP = código Lulo, o coincidencia por descripción).
 */
export async function resolverInsumoIdsParaMaterial(
  supabase: SupabaseClient,
  materialId: string,
): Promise<string[]> {
  const { data: mat, error } = await supabase
    .from('global_inventory')
    .select('id, name, sap_code')
    .eq('id', materialId)
    .maybeSingle();

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);
  if (!mat) return [];

  const ids = new Set<string>();
  const sap = String(mat.sap_code ?? '').trim();

  if (sap) {
    const { data: porCodigo } = await supabase
      .from('ci_lulo_insumos_maestro')
      .select('id')
      .eq('codigo', sap);
    if (porCodigo?.length) {
      for (const row of porCodigo) ids.add(String(row.id));
    }
  }

  const { data: insumos, error: iErr } = await supabase
    .from('ci_lulo_insumos_maestro')
    .select('id, codigo, descripcion')
    .limit(5000);

  if (iErr?.code === '42P01') return Array.from(ids);
  if (iErr) throw new Error(iErr.message);

  const catalog = (insumos ?? []) as InsumoRow[];
  const nombre = String(mat.name ?? '').trim();
  if (nombre) {
    const hit = matchProcurementMaterialId(
      nombre,
      catalog.map((i) => ({
        id: i.id,
        name: i.descripcion,
        sap_code: i.codigo,
      })),
    );
    if (hit) ids.add(hit);
  }

  if (ids.size === 0 && nombre.length >= 4) {
    const target = norm(nombre);
    for (const ins of catalog) {
      const desc = norm(ins.descripcion);
      if (desc.includes(target) || target.includes(desc)) {
        ids.add(ins.id);
      }
    }
  }

  return Array.from(ids);
}
