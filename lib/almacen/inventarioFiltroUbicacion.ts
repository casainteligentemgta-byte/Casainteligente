import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarUbicacionesInventario,
  propagarObraIdFlat,
} from '@/lib/almacen/ubicacionesInventario';
import type { UbicacionInventario } from '@/types/inventario-obra';

export type StockEnUbicacionResumen = {
  cantidad_disponible: number;
  ubicacion_nombres: string[];
  /** Proyecto(s) de obra según inv_ubicaciones / stock físico (no solo catálogo). */
  proyecto_ids: string[];
  proyecto_nombres: string[];
  /** Depósito físico (inventory_deposits) según inv_ubicaciones del stock. */
  deposit_ids: string[];
};

export function crearStockResumenVacio(): StockEnUbicacionResumen {
  return {
    cantidad_disponible: 0,
    ubicacion_nombres: [],
    proyecto_ids: [],
    proyecto_nombres: [],
    deposit_ids: [],
  };
}

function agregarProyectoAlResumen(
  resumen: StockEnUbicacionResumen,
  proyectoId?: string | null,
  proyectoNombre?: string | null,
): void {
  const pid = proyectoId?.trim();
  if (pid && !resumen.proyecto_ids.includes(pid)) {
    resumen.proyecto_ids.push(pid);
  }
  const nombre = proyectoNombre?.trim();
  if (nombre && !resumen.proyecto_nombres.includes(nombre)) {
    resumen.proyecto_nombres.push(nombre);
  }
}

function agregarDepositoAlResumen(
  resumen: StockEnUbicacionResumen,
  depositId?: string | null,
): void {
  const did = depositId?.trim();
  if (did && !resumen.deposit_ids.includes(did)) {
    resumen.deposit_ids.push(did);
  }
}

/** Fusiona cantidad y etiquetas de ubicación/proyecto en el resumen por material. */
export function fusionarFilaEnResumenStock(
  map: Map<string, StockEnUbicacionResumen>,
  materialId: string,
  opts: {
    cantidad: number;
    ubicacionNombre: string;
    proyectoId?: string | null;
    proyectoNombre?: string | null;
    depositId?: string | null;
  },
): void {
  const nombreUb = opts.ubicacionNombre.trim() || 'Almacén';
  const prev = map.get(materialId) ?? crearStockResumenVacio();
  prev.cantidad_disponible += opts.cantidad;
  if (!prev.ubicacion_nombres.includes(nombreUb)) {
    prev.ubicacion_nombres.push(nombreUb);
  }
  agregarProyectoAlResumen(prev, opts.proyectoId, opts.proyectoNombre);
  agregarDepositoAlResumen(prev, opts.depositId);
  map.set(materialId, prev);
}

/** Rellena proyecto en resúmenes que solo tienen ubicación (p. ej. fallback RPC). */
export function enriquecerMapaStockConProyectoFiltro(
  map: Map<string, StockEnUbicacionResumen>,
  opts: { proyectoId?: string; proyectoNombre?: string },
): void {
  const pid = opts.proyectoId?.trim();
  const nombre = opts.proyectoNombre?.trim();
  if (!pid && !nombre) return;
  for (const resumen of Array.from(map.values())) {
    if (!resumen.proyecto_ids.length && !resumen.proyecto_nombres.length) {
      agregarProyectoAlResumen(resumen, pid, nombre);
    }
  }
}

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
    u.deposit_name ?? '',
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

/**
 * El almacén central suele tener ci_proyecto_id null pero el mismo nombre que la obra
 * (p. ej. RANCHO FLAMBOYANT). Si ya entró la ubicación tipo obra, incluir el central hermano.
 */
function incluirAlmacenesCentralesHermanoObra(
  flat: UbicacionInventario[],
  candidatas: UbicacionInventario[],
): UbicacionInventario[] {
  const byId = new Map(candidatas.map((u) => [u.id, u]));
  const nombresObra = new Set(
    candidatas
      .filter((u) => u.tipo === 'obra' || u.tipo === 'cuarentena' || u.tipo === 'garantias')
      .map((u) => normalizarEtiquetaUbicacion(u.nombre)),
  );
  const nombresCentral = new Set(
    candidatas
      .filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil')
      .map((u) => normalizarEtiquetaUbicacion(u.nombre)),
  );

  for (const u of flat) {
    if (u.tipo !== 'almacen_central' && u.tipo !== 'almacen_movil') continue;
    if (byId.has(u.id)) continue;
    const nom = normalizarEtiquetaUbicacion(u.nombre);
    if (nombresObra.has(nom)) {
      byId.set(u.id, u);
    }
  }

  for (const u of flat) {
    if (u.tipo !== 'obra' && u.tipo !== 'cuarentena' && u.tipo !== 'garantias') continue;
    if (byId.has(u.id)) continue;
    const nom = normalizarEtiquetaUbicacion(u.nombre);
    if (nombresCentral.has(nom)) {
      byId.set(u.id, u);
    }
  }

  return Array.from(byId.values());
}

export function expandirUbicacionesHermanoObra(
  flat: UbicacionInventario[],
  candidatas: UbicacionInventario[],
): UbicacionInventario[] {
  return incluirAlmacenesCentralesHermanoObra(flat, candidatas);
}

/** Incluye bodegas/subsitios hijos de almacenes ya seleccionados (ahí suele estar el stock físico). */
export function expandirDescendientesUbicacion(
  flat: UbicacionInventario[],
  raices: UbicacionInventario[],
): UbicacionInventario[] {
  const byPadre = new Map<string, UbicacionInventario[]>();
  for (const u of flat) {
    const padre = u.ubicacion_padre_id?.trim();
    if (!padre) continue;
    const arr = byPadre.get(padre) ?? [];
    arr.push(u);
    byPadre.set(padre, arr);
  }

  const out = new Map(raices.map((u) => [u.id, u]));
  const queue = raices.map((u) => u.id);
  while (queue.length) {
    const id = queue.shift()!;
    for (const hijo of byPadre.get(id) ?? []) {
      if (!out.has(hijo.id)) {
        out.set(hijo.id, hijo);
        queue.push(hijo.id);
      }
    }
  }
  return Array.from(out.values());
}

export function esUbicacionAlmacenFisico(tipo: string | undefined | null): boolean {
  return tipo === 'almacen_central' || tipo === 'almacen_movil' || !tipo || tipo === 'cuarentena';
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
    candidatas = incluirAlmacenesCentralesHermanoObra(flat, candidatas);
    candidatas = expandirDescendientesUbicacion(flat, candidatas);
  }
  if (opts.depositId) {
    const antesDeposito = candidatas;
    candidatas = candidatas.filter((u) => u.deposit_id === opts.depositId);
    // Obra/subsitios a veces no tienen deposit_id aunque el stock esté en el almacén del proyecto.
    if (!candidatas.length && opts.proyectoId && antesDeposito.length) {
      candidatas = antesDeposito;
    }
  }
  return candidatas.map((u) => u.id);
}

export type ProyectoFiltroUbicacion = {
  id: string;
  nombre: string;
  entidad_id: string | null;
};

export function proyectoIdsDeEntidad(
  proyectos: ProyectoFiltroUbicacion[],
  entidadId: string,
): Set<string> {
  const eid = entidadId.trim();
  if (!eid) return new Set();
  return new Set(proyectos.filter((p) => p.entidad_id === eid).map((p) => p.id));
}

/** Ubicaciones de todos los proyectos/obras de una entidad (y almacenes centrales hermanos). */
export function resolverUbicacionIdsFiltroEntidad(
  ubicaciones: UbicacionInventario[],
  opts: {
    entidadId: string;
    proyectos: ProyectoFiltroUbicacion[];
    proyectoId?: string;
    depositId?: string;
  },
): string[] {
  const flat = [...ubicaciones];
  propagarObraIdFlat(flat);
  propagarDepositIdFlat(flat);

  const eid = opts.entidadId.trim();
  if (!eid) return [];

  let proys = opts.proyectos.filter((p) => p.entidad_id === eid);
  if (opts.proyectoId) {
    proys = proys.filter((p) => p.id === opts.proyectoId);
  }

  const byId = new Map<string, UbicacionInventario>();
  for (const pr of proys) {
    let candidatas = flat.filter((u) =>
      ubicacionPerteneceAProyecto(u, pr.id, pr.nombre),
    );
    candidatas = incluirAlmacenesCentralesHermanoObra(flat, candidatas);
    for (const u of candidatas) byId.set(u.id, u);
  }

  let result = Array.from(byId.values());
  if (opts.depositId) {
    const filtradas = result.filter((u) => u.deposit_id === opts.depositId);
    if (filtradas.length) result = filtradas;
  }

  return result.map((u) => u.id);
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
  ubicacion:inv_ubicaciones (
    id,
    nombre,
    deposit_id,
    ci_proyecto_id,
    proyecto:ci_proyectos ( id, nombre )
  )
`;

type UbicacionStockRow = {
  nombre?: string;
  deposit_id?: string | null;
  ci_proyecto_id?: string | null;
  proyecto?: { id: string; nombre: string } | Array<{ id: string; nombre: string }> | null;
};

function parseUbicacionStockRow(
  raw: UbicacionStockRow | UbicacionStockRow[] | null | undefined,
): { nombre: string; proyectoId?: string; proyectoNombre?: string; depositId?: string } {
  const ub = Array.isArray(raw) ? raw[0] : raw;
  const proyRaw = ub?.proyecto;
  const proy = Array.isArray(proyRaw) ? proyRaw[0] : proyRaw;
  const proyectoId = String(proy?.id ?? ub?.ci_proyecto_id ?? '').trim() || undefined;
  const proyectoNombre = String(proy?.nombre ?? '').trim() || undefined;
  const depositId = String(ub?.deposit_id ?? '').trim() || undefined;
  return {
    nombre: String(ub?.nombre ?? 'Almacén').trim() || 'Almacén',
    proyectoId,
    proyectoNombre,
    depositId,
  };
}

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
    let data: Array<Record<string, unknown>> | null = null;
    let error: { code?: string; message?: string } | null = null;

    const res = await supabase
      .from('inventario_stock')
      .select(SELECT_STOCK_FILTRO)
      .in('ubicacion_id', batch)
      .gt('cantidad_disponible', 0);
    data = res.data;
    error = res.error;

    if (error) {
      const fallback = await supabase
        .from('inventario_stock')
        .select('material_id, cantidad_disponible, ubicacion_id')
        .in('ubicacion_id', batch)
        .gt('cantidad_disponible', 0);
      if (fallback.error?.code === '42P01') return map;
      if (fallback.error) throw new Error(fallback.error.message);
      for (const row of fallback.data ?? []) {
        const materialId = String(row.material_id ?? '');
        if (!materialId) continue;
        const qty = Number(row.cantidad_disponible ?? 0);
        if (qty <= 0) continue;
        fusionarFilaEnResumenStock(map, materialId, {
          cantidad: qty,
          ubicacionNombre: 'Almacén',
        });
      }
      continue;
    }

    for (const row of data ?? []) {
      const materialId = String(row.material_id ?? '');
      if (!materialId) continue;
      const qty = Number(row.cantidad_disponible ?? 0);
      if (qty <= 0) continue;

      const ub = parseUbicacionStockRow(
        row.ubicacion as UbicacionStockRow | UbicacionStockRow[] | null,
      );
      fusionarFilaEnResumenStock(map, materialId, {
        cantidad: qty,
        ubicacionNombre: ub.nombre,
        proyectoId: ub.proyectoId,
        proyectoNombre: ub.proyectoNombre,
        depositId: ub.depositId,
      });
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
