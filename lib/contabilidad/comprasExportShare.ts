import type {
  CompraConfirmadaParaLineas,
  FilaFacturaCanal,
  FiltrosFacturaCanal,
} from '@/lib/contabilidad/filtrosFacturaCanal';
import { filtrarLineasComprasConfirmadas } from '@/lib/contabilidad/filtrosFacturaCanal';
import {
  formatearPrecioUnitarioLineaCompra,
  subtotalBsLineaCompra,
  subtotalUsdLineaCompra,
} from '@/lib/contabilidad/monedaCompra';
import { descargarTextoComoArchivo } from '@/lib/almacen/inventarioExportShare';

export type ComprasExportScope = 'filtrado' | 'completo';

export type CompraCuadroLineaInput = {
  id?: string;
  descripcion: string;
  item_code: string | null;
  cantidad: number;
  precio_unitario?: number;
  subtotal: number;
};

export type CompraCuadroInput = {
  id: string;
  fecha: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_rif: string | null;
  total_amount: number | null;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  moneda?: string | null;
  moneda_original?: string | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
  origen?: string | null;
  estado?: string | null;
  entidad_nombre?: string | null;
  proyecto_nombre?: string | null;
  ubicacion_nombre?: string | null;
  ci_proyectos?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  contabilidad_compra_lineas?: CompraCuadroLineaInput[] | { count: number }[];
};

const CSV_HEADERS = [
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

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function proyectoNombreCompra(c: CompraCuadroInput): string {
  if (c.proyecto_nombre?.trim()) return c.proyecto_nombre.trim();
  const p = c.ci_proyectos;
  if (Array.isArray(p)) return (p[0]?.nombre ?? '').trim();
  return (p?.nombre ?? '').trim();
}

function lineasDetalleCompra(c: CompraCuadroInput): CompraCuadroLineaInput[] {
  const nested = c.contabilidad_compra_lineas;
  if (!Array.isArray(nested) || !nested.length) return [];
  const first = nested[0];
  if (first && 'descripcion' in first) return nested as CompraCuadroLineaInput[];
  return [];
}

export function buildLineasCuadroDesdeCompras<T extends CompraCuadroInput>(
  compras: T[],
  tasaResolver: (c: T) => number | null,
  filtrosLineas: FiltrosFacturaCanal = {},
): FilaFacturaCanal[] {
  const payload: CompraConfirmadaParaLineas[] = compras.map((c) => ({
    id: c.id,
    fecha: String(c.fecha ?? '').slice(0, 10),
    invoice_number: String(c.invoice_number ?? 'S/N').trim(),
    supplier_name: String(c.supplier_name ?? '').trim(),
    supplier_rif: String(c.supplier_rif ?? '').trim(),
    total_amount: Number(c.total_amount) || 0,
    total_amount_usd: c.total_amount_usd,
    tasa_bcv_ves_por_usd: tasaResolver(c),
    moneda: c.moneda,
    moneda_original: c.moneda_original,
    monto_ves: c.monto_ves,
    monto_usd: c.monto_usd,
    origen: String(c.origen ?? ''),
    estado: String(c.estado ?? 'REGISTRADA'),
    entidadNombre: c.entidad_nombre ?? undefined,
    proyectoNombre: proyectoNombreCompra(c) || undefined,
    almacenNombre: c.ubicacion_nombre ?? undefined,
    lineas: lineasDetalleCompra(c).map((l) => {
      const cantidad = Number(l.cantidad) || 0;
      const precio =
        l.precio_unitario != null && Number(l.precio_unitario) >= 0
          ? Number(l.precio_unitario)
          : cantidad > 0
            ? Number(l.subtotal) / cantidad
            : 0;
      return {
        id: l.id,
        descripcion: l.descripcion,
        item_code: l.item_code,
        cantidad,
        precio_unitario: precio,
        subtotal: Number(l.subtotal) || 0,
      };
    }),
  }));
  return filtrarLineasComprasConfirmadas(payload, filtrosLineas);
}

function filaComprasACeldas(row: FilaFacturaCanal): string[] {
  const bs = subtotalBsLineaCompra(row);
  const usd = subtotalUsdLineaCompra(row);
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
  ];
}

export function lineasComprasACsv(filas: FilaFacturaCanal[]): string {
  const lines = [
    CSV_HEADERS.join(','),
    ...filas.map((f) => filaComprasACeldas(f).map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function nombreArchivoComprasCsv(scope: ComprasExportScope): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return scope === 'filtrado'
    ? `cuadro-compras-filtrado-${fecha}.csv`
    : `cuadro-compras-completo-${fecha}.csv`;
}

export function exportarComprasCuadroCsv(
  filas: FilaFacturaCanal[],
  scope: ComprasExportScope,
): boolean {
  if (!filas.length) return false;
  descargarTextoComoArchivo(lineasComprasACsv(filas), nombreArchivoComprasCsv(scope));
  return true;
}
