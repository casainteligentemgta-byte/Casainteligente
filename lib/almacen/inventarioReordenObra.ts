import type { SupabaseClient } from '@supabase/supabase-js';

export type ReordenObraRow = {
  proyecto_id: string;
  material_id: string;
  reorder_point: number;
};

/** Mapa material_id → reorder_point para una obra. */
export async function cargarReordenPorObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<Map<string, number>> {
  const pid = proyectoId.trim();
  const out = new Map<string, number>();
  if (!pid) return out;

  const { data, error } = await supabase
    .from('ci_inventario_reorden_obra')
    .select('material_id, reorder_point')
    .eq('proyecto_id', pid);

  if (error) {
    if (error.code === '42P01' || /does not exist|42703/i.test(error.message ?? '')) {
      return out;
    }
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const mid = String(row.material_id ?? '').trim();
    if (!mid) continue;
    out.set(mid, Number(row.reorder_point) || 0);
  }
  return out;
}

export function reorderPointEfectivo(
  materialId: string,
  fallbackGlobal: number,
  reordenObra?: Map<string, number> | null,
): number {
  const fromObra = reordenObra?.get(materialId);
  if (fromObra != null && Number.isFinite(fromObra)) return fromObra;
  return Number(fallbackGlobal) || 0;
}

export async function guardarReordenObraMaterial(
  supabase: SupabaseClient,
  params: { proyectoId: string; materialId: string; reorderPoint: number },
): Promise<void> {
  const proyectoId = params.proyectoId.trim();
  const materialId = params.materialId.trim();
  const reorderPoint = Math.max(0, Number(params.reorderPoint) || 0);
  if (!proyectoId || !materialId) {
    throw new Error('Obra y material son obligatorios');
  }

  const { error } = await supabase.from('ci_inventario_reorden_obra').upsert(
    {
      proyecto_id: proyectoId,
      material_id: materialId,
      reorder_point: reorderPoint,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proyecto_id,material_id' },
  );

  if (error) {
    if (error.code === '42P01' || /does not exist/i.test(error.message ?? '')) {
      throw new Error(
        'Tabla ci_inventario_reorden_obra no disponible. Aplique migración 246 en Supabase.',
      );
    }
    throw new Error(error.message);
  }
}
