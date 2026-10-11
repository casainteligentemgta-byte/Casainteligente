/**
 * Lista de presupuestos: qué es una «venta», filtros y totales. Lógica pura.
 *
 * En la app no hay un registro de ventas aparte: una venta es un presupuesto que el
 * cliente ya aceptó (aprobado, por pagar, pago parcial o pagado). Por eso «Ventas» es un
 * filtro de esta lista y no otro módulo.
 */
import { ESTADOS_PRESUPUESTO_ACEPTADO } from '@/lib/clientes/presupuestosCliente';
import { saldoPresupuesto } from './cobros';

export type EstadoPresupuesto =
  | 'no_enviado'
  | 'enviado'
  | 'aprobado'
  | 'no_aprobado'
  | 'cobrado'
  | 'parcialmente_pagado'
  | 'pagado';

/** Filtro de la lista: todos, solo las ventas, o un estado concreto. */
export type FiltroLista = 'todos' | 'ventas' | EstadoPresupuesto;

const ESTADOS: readonly EstadoPresupuesto[] = [
  'no_enviado',
  'enviado',
  'aprobado',
  'no_aprobado',
  'cobrado',
  'parcialmente_pagado',
  'pagado',
];

/** Estados que cuentan como venta (el cliente ya aceptó). */
export const ESTADOS_VENTA: readonly string[] = ESTADOS_PRESUPUESTO_ACEPTADO;

export function esVenta(status: string | null | undefined): boolean {
  return ESTADOS_VENTA.indexOf(String(status ?? '').trim()) >= 0;
}

/** Filtro pedido en la dirección (`/presupuestos?ver=ventas`); lo que no se entiende es «todos». */
export function filtroDesdeParametro(valor: string | null | undefined): FiltroLista {
  const v = String(valor ?? '').trim().toLowerCase();
  if (v === 'ventas') return 'ventas';
  return (ESTADOS as readonly string[]).indexOf(v) >= 0 ? (v as EstadoPresupuesto) : 'todos';
}

export type PresupuestoDeLista = {
  status: string;
  subtotal: number | string | null;
  monto_pagado?: number | string | null;
  saldo?: number | string | null;
};

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Lo cobrado de un presupuesto: lo que digan sus abonos o, sin ese dato, todo si está «pagado». */
export function montoPagadoDe(p: PresupuestoDeLista): number {
  if (p.monto_pagado != null && Number.isFinite(Number(p.monto_pagado))) return Number(p.monto_pagado);
  return p.status === 'pagado' ? numero(p.subtotal) : 0;
}

export function saldoDe(p: PresupuestoDeLista): number {
  if (p.saldo != null && Number.isFinite(Number(p.saldo))) return Number(p.saldo);
  return saldoPresupuesto(numero(p.subtotal), montoPagadoDe(p));
}

export type ResumenLista = {
  /** Suma de lo que el cliente aceptó (las ventas). */
  totalAprobado: number;
  /** Suma ya cobrada. */
  totalPagado: number;
  /** Lo aceptado que falta por cobrar. Un presupuesto solo enviado todavía no se debe. */
  totalPorPagar: number;
  ventas: number;
};

const centimos = (n: number) => Math.round(n * 100) / 100;

export function resumenLista(presupuestos: readonly PresupuestoDeLista[]): ResumenLista {
  let aprobado = 0;
  let pagado = 0;
  let porPagar = 0;
  let ventas = 0;
  for (const p of presupuestos) {
    pagado += montoPagadoDe(p);
    if (!esVenta(p.status)) continue;
    ventas += 1;
    aprobado += numero(p.subtotal);
    porPagar += saldoDe(p);
  }
  return { totalAprobado: centimos(aprobado), totalPagado: centimos(pagado), totalPorPagar: centimos(porPagar), ventas };
}
