/** Utilidades de vista Egresos CCO (columnas V4, splits, agrupar). */

export function parsePctDistribucion(descripcion: string): number | null {
  const m = String(descripcion ?? '').match(/\((\d+(?:\.\d+)?)%\)\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function baseDescripcionSinPct(descripcion: string): string {
  return String(descripcion ?? '')
    .replace(/\s*\(\d+(?:\.\d+)?%\)\s*$/, '')
    .trim();
}

/** Clave de agrupación para gastos divididos; null si es fila completa. */
export function claveGastoDividido(row: {
  invoice_number?: string | null;
  fecha?: string | null;
  proveedor?: string | null;
  descripcion?: string | null;
}): string | null {
  const inv = String(row.invoice_number ?? '').trim();
  const splitInv = inv.match(/^CCO-SPLIT-(.+)-(\d+)$/i);
  if (splitInv) return `inv:${splitInv[1]}`;

  const pct = parsePctDistribucion(String(row.descripcion ?? ''));
  if (pct != null && pct > 0 && pct < 100) {
    const base = baseDescripcionSinPct(String(row.descripcion ?? ''));
    if (!base) return null;
    return `desc:${row.fecha ?? ''}|${String(row.proveedor ?? '').trim().toUpperCase()}|${base.toUpperCase()}`;
  }
  return null;
}

export type EgresosColKey =
  | 'id'
  | 'fecha'
  | 'proveedor'
  | 'descripcion'
  | 'factura'
  | 'moneda'
  | 'tasa'
  | 'tasa_binance'
  | 'tasa_usada'
  | 'monto_orig'
  | 'monto_base'
  | 'monto_pagado'
  | 'pct_dist'
  | 'admin_pct'
  | 'brecha'
  | 'honorarios'
  | 'costo_total'
  | 'estado'
  | 'forma_pago'
  | 'tipo'
  | 'capitulo'
  | 'subcapitulo'
  | 'contrato'
  | 'link_factura';

export type EgresosColDef = {
  key: EgresosColKey;
  label: string;
  defaultVisible: boolean;
  align?: 'left' | 'right';
  editable?: boolean;
};

/** Orden y etiquetas alineados al cuadro Streamlit V4 + campos que faltaban en la UI. */
export const EGRESOS_COLUMNAS: EgresosColDef[] = [
  { key: 'id', label: 'ID', defaultVisible: true },
  { key: 'fecha', label: 'Fecha', defaultVisible: true, editable: true },
  { key: 'proveedor', label: 'PROVEEDOR', defaultVisible: true, editable: true },
  { key: 'descripcion', label: 'DESCRIPCION', defaultVisible: true, editable: true },
  { key: 'factura', label: 'Nº Factura', defaultVisible: true },
  { key: 'moneda', label: 'Moneda', defaultVisible: true, editable: true },
  { key: 'tasa', label: 'Tasa', defaultVisible: true, align: 'right', editable: true },
  { key: 'tasa_binance', label: 'Tasa Binance', defaultVisible: false, align: 'right' },
  { key: 'tasa_usada', label: 'Tasa Usada', defaultVisible: true },
  { key: 'monto_orig', label: 'Monto Orig.', defaultVisible: true, align: 'right', editable: true },
  { key: 'monto_base', label: 'Monto Base (USD)', defaultVisible: true, align: 'right' },
  { key: 'monto_pagado', label: 'Monto Pagado', defaultVisible: true, align: 'right' },
  { key: 'pct_dist', label: '% Distribución', defaultVisible: true, align: 'right' },
  { key: 'admin_pct', label: '% Admin', defaultVisible: true, align: 'right', editable: true },
  { key: 'brecha', label: '% Brecha', defaultVisible: false, align: 'right' },
  { key: 'honorarios', label: 'Honorarios (USD)', defaultVisible: true, align: 'right' },
  { key: 'costo_total', label: 'Costo Total (USD)', defaultVisible: true, align: 'right' },
  { key: 'estado', label: 'Estado', defaultVisible: true, editable: true },
  { key: 'forma_pago', label: 'Forma de Pago', defaultVisible: true, editable: true },
  { key: 'tipo', label: 'TIPO / Rubro', defaultVisible: true, editable: true },
  { key: 'capitulo', label: 'Capítulo', defaultVisible: true, editable: true },
  { key: 'subcapitulo', label: 'Sub-Capítulo', defaultVisible: true, editable: true },
  { key: 'contrato', label: 'Contrato', defaultVisible: false },
  { key: 'link_factura', label: 'LINK FACTURA', defaultVisible: true },
];

export function defaultVisibleCols(): Record<EgresosColKey, boolean> {
  const out = {} as Record<EgresosColKey, boolean>;
  for (const c of EGRESOS_COLUMNAS) out[c.key] = c.defaultVisible;
  return out;
}

export function storageKeyColumnas(proyectoId: string): string {
  return `cco.egresos.cols.v3.${proyectoId}`;
}

export const EGRESOS_ESTADOS = ['PAGADO', 'PENDIENTE', 'ANULADO', 'PARCIAL'] as const;

export const FORMAS_PAGO_CCO = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'ZELLE',
  'PAGO MOVIL',
  'CHEQUE',
  'CREDITO',
] as const;
