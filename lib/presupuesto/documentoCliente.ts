/**
 * Datos del documento que ve el cliente: precios, descuentos, IVA y Bs.
 * Nunca incluye costos, margen ni ganancia.
 */
import { numeroPresupuesto } from './datosPresupuesto';
import { fechaDocumentoDeBudget, formatFechaPresupuestoLarga } from './fecha';
import {
  descuentoLineaUsd,
  esExentoIva,
  ivaMontoDe,
  IVA_PCT_DEFAULT,
  normalizarIvaPct,
  redondearCentimos,
  totalConIvaDe,
  totalReferencialBs,
} from './iva';
import { lineaPresupuestoTitulo, textoPresupuesto, tituloPresupuestoPlano } from './presentacion';

export type DocumentoItemCliente = {
  nombre: string;
  descripcion: string | null;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  descuentoUsd: number;
};

export type DocumentoPresupuestoCliente = {
  id: string | null;
  numero: string;
  fecha: string;
  cliente: string;
  rif: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas: string;
  showZelle: boolean;
  items: DocumentoItemCliente[];
  subtotal: number;
  descuentoTotal: number;
  ivaPct: number;
  ivaMonto: number;
  totalConIva: number;
  exento: boolean;
  tasaBcv: number | null;
  tasaBcvFecha: string | null;
  totalBs: number | null;
};

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const CAMPOS_COSTO = /^(costo|cost|total_cost|totalCost|total_profit|totalProfit|margin_pct|marginPct|utilidad)$/i;

export function quitarCostos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(quitarCostos);
  if (!valor || typeof valor !== 'object') return valor;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_COSTO.test(k)) continue;
    out[k] = quitarCostos(v);
  }
  return out;
}

export function itemDocumentoDesdeJson(row: unknown): DocumentoItemCliente {
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const pd =
    r.product_data && typeof r.product_data === 'object'
      ? (r.product_data as Record<string, unknown>)
      : r;
  const nombreBruto = str(r.nombre || pd.nombre) || 'Ítem';
  const descBruta = str(r.descripcion ?? pd.descripcion);
  const qty = num(r.qty);
  const unitPrice = num(r.unit_price ?? r.unitPrice);
  const discount = num(r.discount);
  const lineTotal = redondearCentimos(unitPrice * (1 - discount / 100) * qty);
  return {
    nombre: lineaPresupuestoTitulo(nombreBruto),
    descripcion: descBruta ? textoPresupuesto(tituloPresupuestoPlano(descBruta)) : null,
    qty,
    unitPrice,
    discount,
    lineTotal,
    descuentoUsd: descuentoLineaUsd(unitPrice, discount, qty),
  };
}

export function itemsDocumentoDesdeBudget(raw: unknown): DocumentoItemCliente[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(itemDocumentoDesdeJson);
}

export function documentoDesdeBudget(
  budget: Record<string, unknown>,
  extra?: {
    telefono?: string;
    email?: string;
    direccion?: string;
    tasaBcv?: number | null;
    tasaBcvFecha?: string | null;
  },
): DocumentoPresupuestoCliente {
  const items = itemsDocumentoDesdeBudget(budget.items);
  const subtotal = redondearCentimos(num(budget.subtotal) || items.reduce((s, i) => s + i.lineTotal, 0));
  const ivaPct = normalizarIvaPct(budget.iva_pct ?? budget.ivaPct ?? IVA_PCT_DEFAULT);
  const ivaMonto = ivaMontoDe(subtotal, ivaPct);
  const totalConIva = totalConIvaDe(subtotal, ivaPct);
  const tasa = extra?.tasaBcv != null && extra.tasaBcv > 0 ? extra.tasaBcv : null;
  const id = str(budget.id) || null;
  const correlativo = budget.numero_correlativo ?? budget.numero;
  return {
    id,
    numero: typeof correlativo === 'string' && /^p-/i.test(correlativo)
      ? correlativo
      : numeroPresupuesto(correlativo as number | string | null | undefined),
    fecha: formatFechaPresupuestoLarga(fechaDocumentoDeBudget(budget)),
    cliente: str(budget.customer_name ?? budget.cliente),
    rif: str(budget.customer_rif ?? budget.rif),
    telefono: extra?.telefono ? str(extra.telefono) : undefined,
    email: extra?.email ? str(extra.email) : undefined,
    direccion: extra?.direccion ? str(extra.direccion) : undefined,
    notas: str(budget.notes ?? budget.notas),
    showZelle: budget.show_zelle !== false && budget.showZelle !== false,
    items,
    subtotal,
    descuentoTotal: redondearCentimos(items.reduce((s, i) => s + i.descuentoUsd, 0)),
    ivaPct,
    ivaMonto,
    totalConIva,
    exento: esExentoIva(ivaPct),
    tasaBcv: tasa,
    tasaBcvFecha: extra?.tasaBcvFecha ?? null,
    totalBs: tasa ? totalReferencialBs(totalConIva, tasa) : null,
  };
}

export function documentoSinCostosParaCliente(
  doc: DocumentoPresupuestoCliente,
): DocumentoPresupuestoCliente {
  return quitarCostos(doc) as DocumentoPresupuestoCliente;
}
