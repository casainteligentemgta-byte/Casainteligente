import type { PeriodoCompras } from '@/lib/contabilidad/comprasFiltros';
import type { FiltroFuenteCompra } from '@/lib/contabilidad/mapCanalPendienteCompra';
import type { EstadoLogisticaCompra } from '@/lib/contabilidad/estadoLogisticaCompra';
import type { ColumnaOrdenCompras, DireccionOrden } from '@/lib/contabilidad/ordenarLineasCompras';
import {
  parseColumnaOrdenCompras,
  parseDireccionOrden,
} from '@/lib/contabilidad/ordenarLineasCompras';

export type ComprasCuadroShareState = {
  fuenteFiltro: FiltroFuenteCompra;
  periodo: PeriodoCompras;
  fechaRef: string;
  fechaDesde: string;
  fechaHasta: string;
  proyectoFiltro: string;
  entidadFiltro: string;
  proveedorFiltro: string;
  rifFiltro: string;
  busqueda: string;
  articuloFiltro: string;
  cantidadMin: string;
  cantidadMax: string;
  montoMinBs: string;
  montoMaxBs: string;
  montoMinUsd: string;
  montoMaxUsd: string;
  vistaListado: 'facturas' | 'lineas';
  sortColumn?: ColumnaOrdenCompras | null;
  sortDir?: DireccionOrden;
};

export type ComprasCuadroFiltrosState = ComprasCuadroShareState & {
  estadoLogisticaFiltro?: EstadoLogisticaCompra | '';
};

export const COMPRAS_CUADRO_FILTROS_STORAGE_KEY = 'ci-compras-cuadro-filtros-v1';

const SHARE_QUERY_KEYS = [
  'fuente',
  'periodo',
  'ref',
  'desde',
  'hasta',
  'proyecto',
  'entidad',
  'proveedor',
  'rif',
  'q',
  'articulo',
  'cmin',
  'cmax',
  'mminbs',
  'mmaxbs',
  'mminusd',
  'mmaxusd',
  'vista',
  'sort',
  'dir',
  'logistica',
] as const;

const ESTADOS_LOGISTICA: EstadoLogisticaCompra[] = [
  'sin_documento',
  'registrada',
  'cuarentena',
  'en_almacen_parcial',
  'en_almacen',
  'rechazo_cuarentena',
];

function setParam(qs: URLSearchParams, key: string, value: string | undefined | null) {
  const v = String(value ?? '').trim();
  if (v) qs.set(key, v);
}

export function hasComprasCuadroShareParams(params: URLSearchParams): boolean {
  return SHARE_QUERY_KEYS.some((k) => params.has(k));
}

export function buildComprasCuadroSearchParams(state: ComprasCuadroFiltrosState): URLSearchParams {
  const qs = new URLSearchParams();
  if (state.fuenteFiltro !== 'todos') qs.set('fuente', state.fuenteFiltro);
  if (state.periodo !== 'todas') qs.set('periodo', state.periodo);
  setParam(qs, 'ref', state.fechaRef);
  setParam(qs, 'desde', state.fechaDesde);
  setParam(qs, 'hasta', state.fechaHasta);
  setParam(qs, 'proyecto', state.proyectoFiltro);
  setParam(qs, 'entidad', state.entidadFiltro);
  setParam(qs, 'proveedor', state.proveedorFiltro);
  setParam(qs, 'rif', state.rifFiltro);
  setParam(qs, 'q', state.busqueda);
  setParam(qs, 'articulo', state.articuloFiltro);
  setParam(qs, 'cmin', state.cantidadMin);
  setParam(qs, 'cmax', state.cantidadMax);
  setParam(qs, 'mminbs', state.montoMinBs);
  setParam(qs, 'mmaxbs', state.montoMaxBs);
  setParam(qs, 'mminusd', state.montoMinUsd);
  setParam(qs, 'mmaxusd', state.montoMaxUsd);
  if (state.vistaListado !== 'lineas') qs.set('vista', state.vistaListado);
  if (state.sortColumn) qs.set('sort', state.sortColumn);
  if (state.sortDir === 'desc') qs.set('dir', 'desc');
  if (state.estadoLogisticaFiltro) qs.set('logistica', state.estadoLogisticaFiltro);
  return qs;
}

export function comprasCuadroPathFromState(state: ComprasCuadroFiltrosState): string {
  const query = buildComprasCuadroSearchParams(state).toString();
  return query ? `/contabilidad/compras?${query}` : '/contabilidad/compras';
}

export function buildComprasCuadroShareUrl(
  baseOrigin: string,
  state: ComprasCuadroFiltrosState,
): string {
  const query = buildComprasCuadroSearchParams(state).toString();
  const origin = baseOrigin.replace(/\/$/, '');
  return query ? `${origin}/contabilidad/compras?${query}` : `${origin}/contabilidad/compras`;
}

export function parseComprasCuadroShareParams(
  params: URLSearchParams,
): Partial<ComprasCuadroFiltrosState> {
  const fuente = params.get('fuente');
  const periodo = params.get('periodo');
  const vista = params.get('vista');
  const out: Partial<ComprasCuadroFiltrosState> = {};
  if (fuente === 'telegram' || fuente === 'app') out.fuenteFiltro = fuente;
  if (
    periodo === 'todas' ||
    periodo === 'dia' ||
    periodo === 'semana' ||
    periodo === 'mes' ||
    periodo === 'rango'
  ) {
    out.periodo = periodo;
  }
  const ref = params.get('ref')?.trim();
  if (ref) out.fechaRef = ref;
  const desde = params.get('desde')?.trim();
  if (desde) out.fechaDesde = desde;
  const hasta = params.get('hasta')?.trim();
  if (hasta) out.fechaHasta = hasta;
  const proyecto = params.get('proyecto')?.trim();
  if (proyecto) out.proyectoFiltro = proyecto;
  const entidad = params.get('entidad')?.trim();
  if (entidad) out.entidadFiltro = entidad;
  const proveedor = params.get('proveedor')?.trim();
  if (proveedor) out.proveedorFiltro = proveedor;
  const rif = params.get('rif')?.trim();
  if (rif) out.rifFiltro = rif;
  const q = params.get('q')?.trim();
  if (q) out.busqueda = q;
  const articulo = params.get('articulo')?.trim();
  if (articulo) out.articuloFiltro = articulo;
  const cmin = params.get('cmin')?.trim();
  if (cmin) out.cantidadMin = cmin;
  const cmax = params.get('cmax')?.trim();
  if (cmax) out.cantidadMax = cmax;
  const mminbs = params.get('mminbs')?.trim();
  if (mminbs) out.montoMinBs = mminbs;
  const mmaxbs = params.get('mmaxbs')?.trim();
  if (mmaxbs) out.montoMaxBs = mmaxbs;
  const mminusd = params.get('mminusd')?.trim();
  if (mminusd) out.montoMinUsd = mminusd;
  const mmaxusd = params.get('mmaxusd')?.trim();
  if (mmaxusd) out.montoMaxUsd = mmaxusd;
  if (vista === 'facturas' || vista === 'lineas') out.vistaListado = vista;
  const sort = parseColumnaOrdenCompras(params.get('sort'));
  if (sort) out.sortColumn = sort;
  const dir = params.get('dir');
  if (dir === 'asc' || dir === 'desc') out.sortDir = parseDireccionOrden(dir);
  const logistica = params.get('logistica')?.trim();
  if (logistica && ESTADOS_LOGISTICA.includes(logistica as EstadoLogisticaCompra)) {
    out.estadoLogisticaFiltro = logistica as EstadoLogisticaCompra;
  }
  return out;
}

export function leerComprasCuadroFiltrosGuardados(): Partial<ComprasCuadroFiltrosState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COMPRAS_CUADRO_FILTROS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ComprasCuadroFiltrosState>;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function guardarComprasCuadroFiltros(state: ComprasCuadroFiltrosState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMPRAS_CUADRO_FILTROS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / modo privado */
  }
}

export function borrarComprasCuadroFiltrosGuardados(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(COMPRAS_CUADRO_FILTROS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function copiarTextoCuadro(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
