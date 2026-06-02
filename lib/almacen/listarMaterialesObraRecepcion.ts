import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';

export type MaterialObraRecepcion = MaterialCampoOpcion;

function mapRow(row: {
  id: string;
  name?: string | null;
  sap_code?: string | null;
  unit?: string | null;
}): MaterialObraRecepcion {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Material').trim() || 'Material',
    sap_code: row.sap_code?.trim() || null,
    unit: String(row.unit ?? 'UND').trim() || 'UND',
  };
}

/** Materiales del catálogo vinculados a la obra y los que ya tienen stock en sus ubicaciones. */
export async function listarMaterialesObraRecepcion(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<MaterialObraRecepcion[]> {
  const pid = proyectoId.trim();
  if (!pid) return [];

  const byId = new Map<string, MaterialObraRecepcion>();

  const { data: delProyecto, error: errProy } = await supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .eq('proyecto_id', pid)
    .order('name')
    .limit(500);

  if (errProy) throw new Error(errProy.message);
  for (const row of delProyecto ?? []) {
    const m = mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string });
    byId.set(m.id, m);
  }

  const { data: ubicaciones, error: errUb } = await supabase
    .from('inv_ubicaciones')
    .select('id')
    .eq('activo', true)
    .eq('ci_proyecto_id', pid);

  if (errUb && !/does not exist/i.test(errUb.message ?? '')) {
    throw new Error(errUb.message);
  }

  const ubIds = (ubicaciones ?? []).map((u) => String(u.id)).filter(Boolean);
  if (ubIds.length) {
    const BATCH = 40;
    for (let i = 0; i < ubIds.length; i += BATCH) {
      const batch = ubIds.slice(i, i + BATCH);
      const { data: stockRows, error: stockErr } = await supabase
        .from('inventario_stock')
        .select('material_id, material:global_inventory ( id, name, sap_code, unit )')
        .in('ubicacion_id', batch)
        .gt('cantidad_disponible', 0);

      if (stockErr?.code === '42P01') break;
      if (stockErr) throw new Error(stockErr.message);

      for (const row of stockRows ?? []) {
        const raw = row.material as
          | { id: string; name?: string; sap_code?: string; unit?: string }
          | Array<{ id: string; name?: string; sap_code?: string; unit?: string }>
          | null;
        const mat = Array.isArray(raw) ? raw[0] : raw;
        if (!mat?.id) continue;
        const m = mapRow(mat);
        byId.set(m.id, m);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
