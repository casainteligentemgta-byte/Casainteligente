import type { VistaMovimientoInventario } from '@/lib/almacen/listarMovimientosInventario';

export type MovimientosCuadroShareState = {
  vista: VistaMovimientoInventario;
  proveedor: string;
  destino: string;
  material: string;
  fechaDesde: string;
  fechaHasta: string;
};

const SHARE_KEYS = ['vista', 'proveedor', 'destino', 'material', 'desde', 'hasta'] as const;

function setParam(qs: URLSearchParams, key: string, value: string | undefined | null) {
  const v = String(value ?? '').trim();
  if (v) qs.set(key, v);
}

export function hasMovimientosCuadroShareParams(params: URLSearchParams): boolean {
  return SHARE_KEYS.some((k) => params.has(k));
}

export function buildMovimientosCuadroSearchParams(
  state: MovimientosCuadroShareState,
): URLSearchParams {
  const qs = new URLSearchParams();
  if (state.vista !== 'todos') qs.set('vista', state.vista);
  setParam(qs, 'proveedor', state.proveedor);
  setParam(qs, 'destino', state.destino);
  setParam(qs, 'material', state.material);
  setParam(qs, 'desde', state.fechaDesde);
  setParam(qs, 'hasta', state.fechaHasta);
  return qs;
}

export function movimientosCuadroPathFromState(state: MovimientosCuadroShareState): string {
  const query = buildMovimientosCuadroSearchParams(state).toString();
  return query ? `/almacen/movimientos?${query}` : '/almacen/movimientos';
}

export function buildMovimientosCuadroShareUrl(
  baseOrigin: string,
  state: MovimientosCuadroShareState,
): string {
  const query = buildMovimientosCuadroSearchParams(state).toString();
  const origin = baseOrigin.replace(/\/$/, '');
  return query ? `${origin}/almacen/movimientos?${query}` : `${origin}/almacen/movimientos`;
}

export function parseMovimientosCuadroShareParams(
  params: URLSearchParams,
): Partial<MovimientosCuadroShareState> {
  const out: Partial<MovimientosCuadroShareState> = {};
  const vista = params.get('vista');
  if (
    vista === 'ingresado' ||
    vista === 'despachado' ||
    vista === 'almacenado' ||
    vista === 'todos'
  ) {
    out.vista = vista;
  }
  const proveedor = params.get('proveedor')?.trim();
  if (proveedor) out.proveedor = proveedor;
  const destino = params.get('destino')?.trim();
  if (destino) out.destino = destino;
  const material = params.get('material')?.trim();
  if (material) out.material = material;
  const desde = params.get('desde')?.trim();
  if (desde) out.fechaDesde = desde;
  const hasta = params.get('hasta')?.trim();
  if (hasta) out.fechaHasta = hasta;
  return out;
}

export async function copiarTextoMovimientosCuadro(text: string): Promise<boolean> {
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
