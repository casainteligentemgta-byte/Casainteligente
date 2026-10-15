/**
 * Número, fechas y avisos de un presupuesto guardado. Lógica pura.
 */
import { esVenta } from './listaPresupuestos';

/** «P-523», o «Borrador» si todavía no se ha guardado (el número lo pone la base al guardar). */
export function numeroPresupuesto(numero: number | string | null | undefined): string {
  const n = typeof numero === 'number' ? numero : typeof numero === 'string' && numero.trim() !== '' ? Number(numero) : NaN;
  return Number.isFinite(n) && n > 0 ? `P-${Math.trunc(n)}` : 'Borrador';
}

const ZONA = 'America/Caracas';

/** «13 oct. 2026, 12:00 p. m.» en hora de Venezuela; '' si no hay fecha válida. */
export function fechaHoraPresupuesto(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-VE', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Adónde abre la vista previa. Con cambios sin guardar (o sin guardar nunca) muestra lo que
 * hay en pantalla —«borrador»—; si no, lo guardado.
 */
export function rutaVistaPrevia(budgetId: string | null | undefined, hayCambiosSinGuardar: boolean): string {
  const id = String(budgetId ?? '').trim();
  if (!id) return '/ventas/preview?borrador=1';
  const base = `/ventas/preview?id=${encodeURIComponent(id)}`;
  return hayCambiosSinGuardar ? `${base}&borrador=1` : base;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  aprobado: 'aprobado',
  cobrado: 'por pagar',
  parcialmente_pagado: 'con pago parcial',
  pagado: 'pagado',
};

/**
 * Aviso al abrir o guardar un presupuesto que el cliente ya aceptó: cambiarlo cambia lo que
 * aceptó. `null` si no hace falta avisar.
 */
export function avisoEditarAceptado(status: string | null | undefined, numero: number | string | null | undefined): string | null {
  if (!esVenta(status)) return null;
  const estado = ETIQUETA_ESTADO[String(status)] ?? String(status);
  return `${numeroPresupuesto(numero)} ya fue aceptado por el cliente (${estado}). Si cambias renglones o precios, cambias lo que el cliente aceptó.`;
}
