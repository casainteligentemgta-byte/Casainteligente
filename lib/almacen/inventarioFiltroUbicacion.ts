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

function normalizarEtiquetaUbicacion(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Misma lógica operativa que el selector de ingreso (Telegram/compras):
 * obra del proyecto + almacén central/móvil cuyo nombre coincide con la obra
 * (p. ej. depósito «RANCHO FLAMBOYANT» sin ci_proyecto_id en BD).
 */
export function ubicacionPerteneceAProyecto(
  u: UbicacionInventario,
  proyectoId: string,
  proyectoNombre?: string,
): boolean {
  if (u.obra_id === proyectoId || u.proyecto?.id === proyectoId) return true;

  const pn = normalizarEtiquetaUbicacion(proyectoNombre ?? u.proyecto?.nombre ?? '');
  if (!pn) return false;

  const etiquetas = [
    u.nombre,
    u.deposit_locality ?? '',
    u.proyecto?.nombre ?? '',
  ]
    .map(normalizarEtiquetaUbicacion)
    .filter(Boolean);

  if (u.tipo === 'obra' || u.tipo === 'cuarentena' || u.tipo === 'garantias') {
    return etiquetas.some((e) => e === pn || e.includes(pn) || pn.includes(e));
  }

  if (u.tipo === 'almacen_central' || u.tipo === 'almacen_movil') {
    return etiquetas.some((e) => e === pn || e.includes(pn) || pn.includes(e));
  }

  return false;
}

/** Ubicaciones que aplican al filtro proyecto y/o depósito del maestro de inventario. */
export function resolverUbicacionIdsFiltro(
  ubicaciones: UbicacionInventario[],
  opts: { proyectoId?: string; proyectoNombre?: string; depositId?: string },
): string[] {
  const flat = [...ubicaciones];
  propagarObraIdFlat(flat);
  propagarDepositIdFlat(flat);

  let candidatas = flat;
  if (opts.proyectoId) {
    candidatas = candidatas.filter((u) =>
      ubicacionPerteneceAProyecto(u, opts.proyectoId!, opts.proyectoNombre),
    );
  }
  if (opts.depositId) {
    candidatas = candidatas.filter((u) => u.deposit_id === opts.depositId);
  }
  return candidatas.map((u) => u.id);
}

/** Coincide asignación de catálogo (global_inventory.proyecto_id / deposit_id). */
export function materialCoincideFiltroProyectoDeposito(
  material: { proyecto_id?: string | null; deposit_id?: string | null },
  opts: { proyectoId?: string; depositId?: string },
): boolean {
  if (opts.proyectoId && String(material.proyecto_id ?? '') !== opts.proyectoId) return false;
  if (opts.depositId && String(material.deposit_id ?? '') !== opts.depositId) return false;
  return Boolean(opts.proyectoId || opts.depositId);
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

export type ValorInventarioDeposito = {
  depositId: string;
  name: string;
  value: number;
  unidades: number;
};

/** Valor USD (cantidad × costo ponderado) agrupado por depósito físico. */
export async function cargarValorInventarioPorDeposito(
  supabase: SupabaseClient,
  costoPorMaterial: Map<string, number>,
  depositLabels: Map<string, string>,
): Promise<ValorInventarioDeposito[]> {
  const valorByDeposit = new Map<string, { value: number; unidades: number }>();
  const ubicaciones = await listarUbicacionesParaFiltroInventario(supabase);
  const flat = [...ubicaciones];
  propagarDepositIdFlat(flat);
  const ubToDeposit = new Map(flat.map((u) => [u.id, u.deposit_id ?? '']));

  const ubicacionIds = flat.map((u) => u.id);
  const BATCH = 40;
  for (let i = 0; i < ubicacionIds.length; i += BATCH) {
    const batch = ubicacionIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('inventario_stock')
      .select('material_id, cantidad_disponible, ubicacion_id')
      .in('ubicacion_id', batch)
      .gt('cantidad_disponible', 0);

    if (error?.code === '42P01') return [];
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const materialId = String(row.material_id ?? '');
      const qty = Number(row.cantidad_disponible ?? 0);
      if (!materialId || qty <= 0) continue;
      const ubId = String(row.ubicacion_id ?? '');
      const depositId = ubToDeposit.get(ubId) || '';
      if (!depositId) continue;
      const cost = costoPorMaterial.get(materialId) ?? 0;
      const prev = valorByDeposit.get(depositId) ?? { value: 0, unidades: 0 };
      prev.value += qty * cost;
      prev.unidades += qty;
      valorByDeposit.set(depositId, prev);
    }
  }

  return Array.from(valorByDeposit.entries())
    .map(([depositId, agg]) => ({
      depositId,
      name: depositLabels.get(depositId) ?? 'Almacén',
      value: agg.value,
      unidades: agg.unidades,
    }))
    .sort((a, b) => b.value - a.value);
}
