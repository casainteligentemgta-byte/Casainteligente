export type TipoMovimientoTrazabilidadFiltro =
  | ''
  | 'entrada_manual'
  | 'entrada_ocr'
  | 'nota_entrega'
  | 'transferencia'
  | 'despacho_obra'
  | 'prestamo'
  | 'perdida_deterioro'
  | 'ajuste'
  | 'anulacion';

export type TrazabilidadCuadroShareState = {
  materialFiltro: string;
  proyectoFiltro: string;
  tipoMovimientoFiltro: TipoMovimientoTrazabilidadFiltro;
  fechaDesde: string;
  fechaHasta: string;
  pagina: number;
  pageSize: number;
};

export const TRAZABILIDAD_CUADRO_FILTROS_STORAGE_KEY = 'ci-trazabilidad-filtros-v1';

const SHARE_QUERY_KEYS = [
  'material',
  'proyecto',
  'tipo',
  'desde',
  'hasta',
  'page',
  'pageSize',
] as const;

const TIPOS_VALIDOS: TipoMovimientoTrazabilidadFiltro[] = [
  '',
  'entrada_manual',
  'entrada_ocr',
  'nota_entrega',
  'transferencia',
  'despacho_obra',
  'prestamo',
  'perdida_deterioro',
  'ajuste',
  'anulacion',
];

function setParam(qs: URLSearchParams, key: string, value: string | number | undefined | null) {
  const v = String(value ?? '').trim();
  if (v) qs.set(key, v);
}

export function hasTrazabilidadCuadroShareParams(params: URLSearchParams): boolean {
  return SHARE_QUERY_KEYS.some((k) => params.has(k));
}

export function buildTrazabilidadCuadroSearchParams(
  state: TrazabilidadCuadroShareState,
): URLSearchParams {
  const qs = new URLSearchParams();
  setParam(qs, 'material', state.materialFiltro);
  setParam(qs, 'proyecto', state.proyectoFiltro);
  if (state.tipoMovimientoFiltro) qs.set('tipo', state.tipoMovimientoFiltro);
  setParam(qs, 'desde', state.fechaDesde);
  setParam(qs, 'hasta', state.fechaHasta);
  if (state.pagina > 1) qs.set('page', String(state.pagina));
  if (state.pageSize !== 50) qs.set('pageSize', String(state.pageSize));
  return qs;
}

export function trazabilidadCuadroPathFromState(state: TrazabilidadCuadroShareState): string {
  const query = buildTrazabilidadCuadroSearchParams(state).toString();
  return query ? `/almacen/trazabilidad?${query}` : '/almacen/trazabilidad';
}

export function parseTrazabilidadCuadroShareParams(
  params: URLSearchParams,
): Partial<TrazabilidadCuadroShareState> {
  const out: Partial<TrazabilidadCuadroShareState> = {};
  const material = params.get('material')?.trim();
  if (material) out.materialFiltro = material;
  const proyecto = params.get('proyecto')?.trim();
  if (proyecto) out.proyectoFiltro = proyecto;
  const tipo = params.get('tipo')?.trim() as TipoMovimientoTrazabilidadFiltro | undefined;
  if (tipo && TIPOS_VALIDOS.includes(tipo)) out.tipoMovimientoFiltro = tipo;
  const desde = params.get('desde')?.trim();
  if (desde) out.fechaDesde = desde;
  const hasta = params.get('hasta')?.trim();
  if (hasta) out.fechaHasta = hasta;
  const page = Number(params.get('page'));
  if (Number.isFinite(page) && page >= 1) out.pagina = Math.floor(page);
  const pageSize = Number(params.get('pageSize'));
  if (Number.isFinite(pageSize) && pageSize >= 10 && pageSize <= 200) {
    out.pageSize = Math.floor(pageSize);
  }
  return out;
}

export function leerTrazabilidadCuadroFiltrosGuardados(): Partial<TrazabilidadCuadroShareState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TRAZABILIDAD_CUADRO_FILTROS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<TrazabilidadCuadroShareState>;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function guardarTrazabilidadCuadroFiltros(state: TrazabilidadCuadroShareState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRAZABILIDAD_CUADRO_FILTROS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / modo privado */
  }
}

export function borrarTrazabilidadCuadroFiltrosGuardados(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRAZABILIDAD_CUADRO_FILTROS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
