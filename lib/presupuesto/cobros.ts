export const METODOS_ABONO_PRESUPUESTO = ['zelle', 'transferencia', 'efectivo', 'otro'] as const;
export type MetodoAbonoPresupuesto = (typeof METODOS_ABONO_PRESUPUESTO)[number];

export type EstadoCuotaPresupuesto = 'pendiente' | 'parcial' | 'pagada' | 'vencida';

export type BudgetAbono = {
  id: string;
  budget_id: string;
  cuota_id: string | null;
  monto: number;
  moneda: 'USD' | 'VES';
  monto_usd: number;
  tasa_bcv: number | null;
  metodo: MetodoAbonoPresupuesto | string;
  banco_origen: string | null;
  referencia: string | null;
  fecha_abono: string;
  notas: string | null;
  created_at: string;
};

export type BudgetCuota = {
  id: string;
  budget_id: string;
  numero: number;
  monto: number;
  fecha_vencimiento: string;
  estado: EstadoCuotaPresupuesto;
  monto_pagado: number;
  notas: string | null;
  created_at: string;
};

export function redondearUsd(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function saldoPresupuesto(subtotal: number, montoPagado: number): number {
  return Math.max(0, redondearUsd(subtotal) - redondearUsd(montoPagado));
}

export function statusDesdeCobro(opts: {
  subtotal: number;
  montoPagado: number;
  statusActual?: string | null;
}): 'pagado' | 'parcialmente_pagado' | string {
  const pagado = redondearUsd(opts.montoPagado);
  const total = redondearUsd(opts.subtotal);
  if (pagado <= 0) return opts.statusActual && opts.statusActual !== 'pagado' ? opts.statusActual : 'cobrado';
  if (pagado + 0.009 >= total && total > 0) return 'pagado';
  return 'parcialmente_pagado';
}

/** Parte el saldo en N cuotas; la última absorbe los céntimos. */
export function repartirCuotas(total: number, cantidad: number): number[] {
  const n = Math.floor(cantidad);
  const t = redondearUsd(total);
  if (n < 1 || t <= 0) return [];
  const base = redondearUsd(t / n);
  const out = Array.from({ length: n }, () => base);
  const suma = redondearUsd(out.reduce((a, b) => a + b, 0));
  out[n - 1] = redondearUsd(out[n - 1] + (t - suma));
  return out.filter((x) => x > 0);
}

export function fechaMasDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function etiquetaMetodoAbono(metodo: string | null | undefined): string {
  const m = String(metodo ?? '').toLowerCase();
  if (m === 'zelle') return 'Zelle';
  if (m === 'transferencia') return 'Transferencia';
  if (m === 'efectivo') return 'Efectivo';
  return 'Otro';
}

export function etiquetaEstadoCuota(c: Pick<BudgetCuota, 'estado' | 'fecha_vencimiento' | 'monto_pagado' | 'monto'>): string {
  if (c.monto_pagado + 0.009 >= c.monto) return 'Pagada';
  if (c.monto_pagado > 0) return 'Parcial';
  const hoy = new Date().toISOString().slice(0, 10);
  if (c.fecha_vencimiento && c.fecha_vencimiento < hoy) return 'Vencida';
  return 'Pendiente';
}
