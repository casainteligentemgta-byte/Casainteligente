import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';

export type StockMaterialUbicacionRow = {
  stock_id: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  cantidad_disponible: number;
};

export async function listarStockMaterial(
  supabase: SupabaseClient,
  materialId: string,
): Promise<StockMaterialUbicacionRow[]> {
  const mid = materialId.trim();
  if (!mid) return [];

  const { data, error } = await supabase
    .from('inventario_stock')
    .select(
      `
      id,
      ubicacion_id,
      cantidad_disponible,
      ubicacion:inv_ubicaciones ( nombre )
    `,
    )
    .eq('material_id', mid)
    .order('cantidad_disponible', { ascending: false });

  if (error?.code === '42P01') {
    throw new Error('Tabla inventario_stock no disponible. Aplique migración 180 en Supabase.');
  }
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const ub = row.ubicacion as { nombre?: string } | { nombre?: string }[] | null;
    const u = Array.isArray(ub) ? ub[0] : ub;
    return {
      stock_id: String(row.id),
      ubicacion_id: String(row.ubicacion_id),
      ubicacion_nombre: String(u?.nombre ?? 'Ubicación').trim() || 'Ubicación',
      cantidad_disponible: Number(row.cantidad_disponible) || 0,
    };
  });
}

/** Fija cantidad_disponible aplicando delta con movimiento tipo ajuste. */
export async function fijarStockMaterialUbicacion(
  supabase: SupabaseClient,
  input: {
    materialId: string;
    ubicacionId: string;
    cantidadNueva: number;
    notas?: string | null;
  },
): Promise<{ aplicado: boolean; cantidadAnterior: number; cantidadNueva: number; delta: number }> {
  const materialId = input.materialId.trim();
  const ubicacionId = input.ubicacionId.trim();
  if (!materialId || !ubicacionId) {
    throw new Error('Material y ubicación son obligatorios.');
  }

  const cantidadNueva = Math.round(Number(input.cantidadNueva) * 10000) / 10000;
  if (!Number.isFinite(cantidadNueva) || cantidadNueva < 0) {
    throw new Error('La cantidad debe ser un número mayor o igual a cero.');
  }

  const { data: row, error: readErr } = await supabase
    .from('inventario_stock')
    .select('cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .eq('material_id', materialId)
    .maybeSingle();

  if (readErr?.code === '42P01') {
    throw new Error('Tabla inventario_stock no disponible. Aplique migración 180 en Supabase.');
  }
  if (readErr) throw new Error(readErr.message);

  const cantidadAnterior = Number(row?.cantidad_disponible) || 0;
  const delta = cantidadNueva - cantidadAnterior;

  if (Math.abs(delta) < 0.0001) {
    return { aplicado: false, cantidadAnterior, cantidadNueva, delta: 0 };
  }

  await aplicarDeltaStockInventario(supabase, {
    ubicacionId,
    materialId,
    deltaDisponible: delta,
    tipoMovimiento: 'ajuste',
    referenciaTipo: 'edicion_activo_almacen',
    notas: input.notas?.trim() || 'Ajuste manual desde editar activo',
  });

  return { aplicado: true, cantidadAnterior, cantidadNueva, delta };
}
