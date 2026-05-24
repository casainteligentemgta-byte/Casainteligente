import type { FilaFacturaCanal } from '@/lib/contabilidad/filtrosFacturaCanal';
import { vesAUsdConTasa } from '@/lib/contabilidad/comprasMontos';

export type ColumnaOrdenCompras =
  | 'fecha'
  | 'factura'
  | 'proveedor'
  | 'rif'
  | 'articulo'
  | 'cantidad'
  | 'precioUnitario'
  | 'subtotalBs'
  | 'usd'
  | 'tasaBcv';

export type DireccionOrden = 'asc' | 'desc';

export const COLUMNAS_ORDEN_COMPRAS: { key: ColumnaOrdenCompras; label: string }[] = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'factura', label: 'Factura' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'rif', label: 'RIF' },
  { key: 'articulo', label: 'Artículo' },
  { key: 'cantidad', label: 'Cant.' },
  { key: 'precioUnitario', label: 'P.U. (Bs)' },
  { key: 'subtotalBs', label: 'Subtotal (Bs)' },
  { key: 'usd', label: 'USD' },
  { key: 'tasaBcv', label: 'Tasa BCV' },
];

export function etiquetaColumnaOrden(key: ColumnaOrdenCompras): string {
  return COLUMNAS_ORDEN_COMPRAS.find((c) => c.key === key)?.label ?? key;
}

export function parseColumnaOrdenCompras(v: string | null | undefined): ColumnaOrdenCompras | null {
  const keys = COLUMNAS_ORDEN_COMPRAS.map((c) => c.key);
  return keys.includes(v as ColumnaOrdenCompras) ? (v as ColumnaOrdenCompras) : null;
}

export function parseDireccionOrden(v: string | null | undefined): DireccionOrden {
  return v === 'desc' ? 'desc' : 'asc';
}

function subtotalBsFila(row: FilaFacturaCanal): number {
  return row.esLinea ? row.cantidad * row.precioUnitario : row.montoBs;
}

function usdFila(row: FilaFacturaCanal): number | null {
  const bs = subtotalBsFila(row);
  const directo = vesAUsdConTasa(bs, row.tasaBcv);
  if (directo != null) return directo;
  if (row.montoUsd != null && row.montoBs > 0) {
    return Math.round(((bs / row.montoBs) * row.montoUsd) * 100) / 100;
  }
  return row.esLinea ? null : row.montoUsd;
}

function valorOrden(row: FilaFacturaCanal, col: ColumnaOrdenCompras): string | number | null {
  switch (col) {
    case 'fecha':
      return row.fecha || '';
    case 'factura':
      return row.factura || '';
    case 'proveedor':
      return row.proveedor || '';
    case 'rif':
      return row.rif || '';
    case 'articulo':
      return row.articulo || '';
    case 'cantidad':
      return row.esLinea ? row.cantidad : null;
    case 'precioUnitario':
      return row.esLinea ? row.precioUnitario : null;
    case 'subtotalBs':
      return subtotalBsFila(row);
    case 'usd':
      return usdFila(row);
    case 'tasaBcv':
      return row.tasaBcv;
    default:
      return '';
  }
}

function compareValores(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

/** Ordena filas del cuadro; si columna es null devuelve copia sin cambios. */
export function ordenarLineasCompras(
  filas: FilaFacturaCanal[],
  columna: ColumnaOrdenCompras | null,
  dir: DireccionOrden,
): FilaFacturaCanal[] {
  if (!columna) return [...filas];
  const mult = dir === 'asc' ? 1 : -1;
  return [...filas].sort((ra, rb) => {
    const cmp = compareValores(valorOrden(ra, columna), valorOrden(rb, columna));
    if (cmp !== 0) return cmp * mult;
    return compareValores(ra.factura, rb.factura) || compareValores(ra.articulo, rb.articulo);
  });
}

/** TSV para copiar / compartir texto tabular. */
export function lineasComprasATsv(filas: FilaFacturaCanal[]): string {
  const header = [
    'Fecha',
    'Factura',
    'Proveedor',
    'RIF',
    'Artículo',
    'Cant.',
    'P.U. (Bs)',
    'Subtotal (Bs)',
    'USD',
    'Tasa BCV',
  ].join('\t');
  const body = filas.map((row) => {
    const bs = subtotalBsFila(row);
    const usd = usdFila(row);
    return [
      row.fecha,
      row.factura,
      row.proveedor,
      row.rif,
      row.esLinea ? row.articulo : '(cabecera)',
      row.esLinea ? String(row.cantidad) : '',
      row.esLinea ? String(row.precioUnitario) : '',
      String(bs),
      usd != null ? String(usd) : '',
      row.tasaBcv != null ? String(row.tasaBcv) : '',
    ].join('\t');
  });
  return [header, ...body].join('\n');
}
