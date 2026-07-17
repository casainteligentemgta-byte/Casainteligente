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
  | 'moneda'
  | 'tasa'
  | 'monto_orig'
  | 'pct_dist'
  | 'admin_pct'
  | 'honorarios'
  | 'costo_total'
  | 'tipo'
  | 'capitulo'
  | 'subcapitulo'
  | 'estado'
  | 'forma_pago';

export type EgresosColDef = {
  key: EgresosColKey;
  label: string;
  defaultVisible: boolean;
  align?: 'left' | 'right';
  editable?: boolean;
};

export const EGRESOS_COLUMNAS: EgresosColDef[] = [
  { key: 'id', label: 'ID', defaultVisible: true },
  { key: 'fecha', label: 'Fecha', defaultVisible: true, editable: true },
  { key: 'proveedor', label: 'PROVEEDOR', defaultVisible: true, editable: true },
  { key: 'descripcion', label: 'DESCRIPCION', defaultVisible: true, editable: true },
  { key: 'moneda', label: 'Moneda', defaultVisible: true, editable: true },
  { key: 'tasa', label: 'Tasa', defaultVisible: true, align: 'right', editable: true },
  { key: 'monto_orig', label: 'Monto Orig.', defaultVisible: true, align: 'right', editable: true },
  { key: 'pct_dist', label: '% Distribución', defaultVisible: true, align: 'right' },
  { key: 'admin_pct', label: '% Admin', defaultVisible: true, align: 'right', editable: true },
  { key: 'honorarios', label: 'Honorarios', defaultVisible: true, align: 'right' },
  { key: 'costo_total', label: 'Costo Total', defaultVisible: true, align: 'right' },
  { key: 'tipo', label: 'Tipo', defaultVisible: false },
  { key: 'capitulo', label: 'Capítulo', defaultVisible: false },
  { key: 'subcapitulo', label: 'Sub-Capítulo', defaultVisible: false },
  { key: 'estado', label: 'Estado', defaultVisible: false },
  { key: 'forma_pago', label: 'Forma pago', defaultVisible: false },
];

export function defaultVisibleCols(): Record<EgresosColKey, boolean> {
  const out = {} as Record<EgresosColKey, boolean>;
  for (const c of EGRESOS_COLUMNAS) out[c.key] = c.defaultVisible;
  return out;
}

export function storageKeyColumnas(proyectoId: string): string {
  return `cco.egresos.cols.${proyectoId}`;
}
