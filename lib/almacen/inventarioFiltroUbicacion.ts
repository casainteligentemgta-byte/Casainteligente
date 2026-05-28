import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarUbicacionesInventario,
  propagarObraIdFlat,
} from '@/lib/almacen/ubicacionesInventario';
import type { UbicacionInventario } from '@/types/inventario-obra';

export type StockEnUbicacionResumen = {
  cantidad_disponible: number;
  ubicacion_nombres: string[];
};

function propagarDepositIdFlat(flat: UbicacionInventario[]): void {
  const byId = new Map(flat.map((u) => [u.id, u]));
  for (const u of flat) {
    if (u.deposit_id || !u.ubicacion_padre_id) continue;
    let p = byId.get(u.ubicacion_padre_id);
    while (p) {
      if (p.deposit_id) {
        u.deposit_id = p.deposit_id;
        break;
      }
      p = p.ubicacion_padre_id ? byId.get(p.ubicacion_padre_id) : undefined;
    }
  }
}

/** Ubicaciones que aplican al filtro proyecto y/o depósito del maestro de inventario. */
export function resolverUbicacionIdsFiltro(
  ubicaciones: UbicacionInventario[],
  opts: { proyectoId?: string; depositId?: string },
): string[] {
  const flat = [...ubicaciones];
  propagarObraIdFlat(flat);
  propagarDepositIdFlat(flat);

  let candidatas = flat;
  if (opts.proyectoId) {
    candidatas = candidatas.filter((u) => u.obra_id === opts.proyectoId);
  }
  if (opts.depositId) {
    candidatas = candidatas.filter((u) => u.deposit_id === opts.depositId);
  }
  return candidatas.map((u) => u.id);
}

const SELECT_STOCK_FILTRO = `
  material_id,
  cantidad_disponible,
  ubicacion:inv_ubicaciones ( id, nombre, deposit_id, ci_proyecto_id )
`;

/** Stock físico por material en las ubicaciones indicadas (migr. 180). */
export async function cargarStockPorUbicaciones(
  supabase: SupabaseClient,
  ubicacionIds: string[],
): Promise<Map<string, StockEnUbicacionResumen>> {
  const map = new Map<string, StockEnUbicacionResumen>();
  if (!ubicacionIds.length) return map;

  const BATCH = 40;
  for (let i = 0; i < ubicacionIds.length; i += BATCH) {
    const batch = ubicacionIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('inventario_stock')
      .select(SELECT_STOCK_FILTRO)
      .in('ubicacion_id', batch)
      .gt('cantidad_disponible', 0);

    if (error?.code === '42P01') return map;
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const materialId = String(row.material_id ?? '');
      if (!materialId) continue;
      const qty = Number(row.cantidad_disponible ?? 0);
      if (qty <= 0) continue;

      const ubRaw = row.ubicacion as
        | { nombre?: string }
        | Array<{ nombre?: string }>
        | null;
      const ub = Array.isArray(ubRaw) ? ubRaw[0] : ubRaw;
      const nombre = String(ub?.nombre ?? 'Almacén').trim() || 'Almacén';

      const prev = map.get(materialId);
      if (prev) {
        prev.cantidad_disponible += qty;
        if (!prev.ubicacion_nombres.includes(nombre)) {
          prev.ubicacion_nombres.push(nombre);
        }
      } else {
        map.set(materialId, {
          cantidad_disponible: qty,
          ubicacion_nombres: [nombre],
        });
      }
    }
  }

  return map;
}

export async function listarUbicacionesParaFiltroInventario(
  supabase: SupabaseClient,
): Promise<UbicacionInventario[]> {
  return listarUbicacionesInventario(supabase, { soloActivas: true });
}
