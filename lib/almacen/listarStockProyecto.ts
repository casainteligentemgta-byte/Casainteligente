import type { SupabaseClient } from '@supabase/supabase-js';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';

export type StockProyectoItem = {
  material_id: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  /** Tipo de ubicación (obra, almacen_central, …) para desglose en /stock. */
  ubicacion_tipo?: string | null;
  nombre: string;
  unidad: string;
  sap_code: string | null;
  categoria: string | null;
  cantidad_disponible: number;
};

/** Stock en todos los almacenes / subsitios de la obra (RPC get_stock_real_obra). */
export async function listarStockProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: { ubicacionId?: string },
): Promise<StockProyectoItem[]> {
  return getStockRealObra(supabase, proyectoId, {
    ubicacionId: opts?.ubicacionId,
    soloConStock: true,
  });
}
