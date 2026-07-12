import type { SupabaseClient } from '@supabase/supabase-js';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';

export type StockUbicacionObra = {
  ubicacion_id: string;
  ubicacion_nombre: string;
  unidades: number;
  materiales: number;
};

export type TotalesStockObra = {
  totalUnidades: number;
  materialesDistintos: number;
  ubicaciones: StockUbicacionObra[];
};

/** Stock disponible agregado por ubicación/almacén de la obra. */
export async function calcularTotalesStockObra(
  supabase: SupabaseClient,
  proyectoId: string,
  proyectoNombre?: string,
): Promise<TotalesStockObra> {
  const filas = await getStockRealObra(supabase, proyectoId, {
    soloConStock: true,
    proyectoNombre,
  });

  const porUb = new Map<string, StockUbicacionObra>();
  const materiales = new Set<string>();
  let totalUnidades = 0;

  for (const f of filas) {
    const qty = Number(f.cantidad_disponible) || 0;
    if (qty <= 0) continue;
    totalUnidades += qty;
    materiales.add(f.material_id);
    const key = f.ubicacion_id;
    const prev = porUb.get(key);
    if (prev) {
      prev.unidades += qty;
      prev.materiales += 1;
    } else {
      porUb.set(key, {
        ubicacion_id: key,
        ubicacion_nombre: f.ubicacion_nombre?.trim() || 'Almacén',
        unidades: qty,
        materiales: 1,
      });
    }
  }

  const ubicaciones = Array.from(porUb.values()).sort((a, b) => b.unidades - a.unidades);

  return {
    totalUnidades,
    materialesDistintos: materiales.size,
    ubicaciones,
  };
}
