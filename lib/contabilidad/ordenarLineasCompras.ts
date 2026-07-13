import type { FilaFacturaCanal } from '@/lib/contabilidad/filtrosFacturaCanal';
import {
  formatearPrecioUnitarioLineaCompra,
  subtotalBsLineaCompra,
  subtotalUsdLineaCompra,
} from '@/lib/contabilidad/monedaCompra';

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
  { key: 'precioUnitario', label: 'P.U.' },
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
  return subtotalBsLineaCompra(row);
}

function usdFila(row: FilaFacturaCanal): number | null {
  return subtotalUsdLineaCompra(row);
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

const TSV_HEADERS = [
  'Fecha',
  'Factura',
  'Proveedor',
  'RIF',
  'Entidad',
  'Obra / Proyecto',
  'Almacén',
  'Artículo',
  'Código',
  'Cant.',
  'P.U.',
  'Subtotal (Bs)',
  'USD',
  'Tasa BCV',
] as const;

function filaComprasATsv(row: FilaFacturaCanal): string {
  const bs = subtotalBsFila(row);
  const usd = usdFila(row);
  return [
    row.fecha,
    row.factura,
    row.proveedor,
    row.rif,
    row.entidad ?? '',
    row.proyecto ?? '',
    row.almacen ?? '',
    row.esLinea ? row.articulo : '(cabecera)',
    row.esLinea ? row.codigo : '',
    row.esLinea ? String(row.cantidad) : '',
    row.esLinea ? formatearPrecioUnitarioLineaCompra(row) ?? '' : '',
    String(bs),
    usd != null ? String(usd) : '',
    row.tasaBcv != null ? String(row.tasaBcv) : '',
  ].join('\t');
}

/** TSV para copiar / compartir texto tabular. */
export function lineasComprasATsv(filas: FilaFacturaCanal[]): string {
  return [TSV_HEADERS.join('\t'), ...filas.map(filaComprasATsv)].join('\n');
}
