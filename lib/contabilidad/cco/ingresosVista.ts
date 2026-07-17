/** Utilidades de vista Control de Ingresos CCO V4. */

export type IngresosColKey =
  | 'sel'
  | 'id'
  | 'fecha'
  | 'proveedor'
  | 'descripcion'
  | 'moneda'
  | 'tasa'
  | 'monto_orig'
  | 'monto_usd'
  | 'forma_pago'
  | 'estado';

export type IngresosColDef = {
  key: IngresosColKey;
  label: string;
  defaultVisible: boolean;
  align?: 'left' | 'right';
  editable?: boolean;
};

export const INGRESOS_COLUMNAS: IngresosColDef[] = [
  { key: 'sel', label: '', defaultVisible: true },
  { key: 'id', label: 'ID', defaultVisible: true },
  { key: 'fecha', label: 'Fecha', defaultVisible: true, editable: true },
  { key: 'proveedor', label: 'PROVEEDOR', defaultVisible: true, editable: true },
  { key: 'descripcion', label: 'DESCRIPCION', defaultVisible: true, editable: true },
  { key: 'moneda', label: 'Moneda', defaultVisible: true, editable: true },
  { key: 'tasa', label: 'Tasa', defaultVisible: true, align: 'right', editable: true },
  { key: 'monto_orig', label: 'Monto Orig.', defaultVisible: true, align: 'right', editable: true },
  { key: 'monto_usd', label: 'Monto USD', defaultVisible: true, align: 'right' },
  { key: 'forma_pago', label: 'Forma de Pago', defaultVisible: false, editable: true },
  { key: 'estado', label: 'Estado', defaultVisible: false },
];

export function defaultVisibleColsIngresos(): Record<IngresosColKey, boolean> {
  const out = {} as Record<IngresosColKey, boolean>;
  for (const c of INGRESOS_COLUMNAS) out[c.key] = c.defaultVisible;
  return out;
}

export function storageKeyColumnasIngresos(proyectoId: string): string {
  return `cco.ingresos.cols.v1.${proyectoId}`;
}

/** Parsea origen_fondo CCO → id V4, proveedor y descripción. */
export function parseOrigenIngreso(origenFondo: string): {
  origen_v4_id: number | null;
  proveedor: string;
  descripcion: string;
} {
  const raw = String(origenFondo ?? '').trim();
  const v4 = raw.match(/^CCO-V4\s*#(\d+)\s*·\s*(.*)$/i);
  if (v4) {
    const rest = v4[2].trim();
    const parts = rest.split(/\s*·\s*/);
    if (parts.length >= 2) {
      return {
        origen_v4_id: Number(v4[1]),
        proveedor: parts[0].trim() || 'CLIENTE',
        descripcion: parts.slice(1).join(' · ').trim() || rest,
      };
    }
    return {
      origen_v4_id: Number(v4[1]),
      proveedor: 'CLIENTE',
      descripcion: rest || 'Ingreso',
    };
  }
  const cco = raw.match(/^CCO\s*·\s*(.*)$/i);
  if (cco) {
    const rest = cco[1].trim();
    const parts = rest.split(/\s*·\s*/);
    if (parts.length >= 2) {
      return {
        origen_v4_id: null,
        proveedor: parts[0].trim() || 'CLIENTE',
        descripcion: parts.slice(1).join(' · ').trim() || rest,
      };
    }
    return { origen_v4_id: null, proveedor: 'CLIENTE', descripcion: rest || 'Ingreso' };
  }
  const parts = raw.split(/\s*·\s*/);
  if (parts.length >= 2) {
    return {
      origen_v4_id: null,
      proveedor: parts[0].trim() || 'CLIENTE',
      descripcion: parts.slice(1).join(' · ').trim() || raw,
    };
  }
  return { origen_v4_id: null, proveedor: 'CLIENTE', descripcion: raw || 'Ingreso' };
}

export function buildOrigenIngreso(opts: {
  origen_v4_id: number | null;
  proveedor: string;
  descripcion: string;
}): string {
  const prov = String(opts.proveedor ?? '').trim() || 'CLIENTE';
  const desc = String(opts.descripcion ?? '').trim() || 'Ingreso';
  if (opts.origen_v4_id != null && opts.origen_v4_id > 0) {
    return `CCO-V4 #${opts.origen_v4_id} · ${prov} · ${desc}`.slice(0, 200);
  }
  return `CCO · ${prov} · ${desc}`.slice(0, 200);
}
