/**
 * Presupuestos de un cliente: lo que la ficha muestra y lo que decide si se puede borrar.
 *
 * Funciones puras más dos lecturas que reciben el cliente de Supabase, para poder
 * probarlas sin navegador.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Estados en los que el cliente ya aceptó el presupuesto (igual que la pantalla Presupuestos). */
export const ESTADOS_PRESUPUESTO_ACEPTADO = ['aprobado', 'cobrado', 'parcialmente_pagado', 'pagado'] as const;

const ETIQUETAS_ESTADO: Record<string, string> = {
  no_enviado: 'No enviado',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
  no_aprobado: 'No aprobado',
  cobrado: 'Por pagar',
  parcialmente_pagado: 'Pago parcial',
  pagado: 'Pagado',
};

export type TonoEstadoPresupuesto = 'verde' | 'ambar' | 'azul' | 'rojo' | 'gris';

const TONOS_ESTADO: Record<string, TonoEstadoPresupuesto> = {
  pagado: 'verde',
  aprobado: 'verde',
  cobrado: 'ambar',
  parcialmente_pagado: 'ambar',
  enviado: 'azul',
  no_aprobado: 'rojo',
};

export type PresupuestoCliente = {
  id: string;
  subtotal: number;
  status: string;
  created_at: string | null;
};

export type ResumenPresupuestosCliente = {
  cantidad: number;
  aceptados: number;
  /** Suma de los aceptados (aprobado, por pagar, pago parcial y pagado). */
  montoAceptadoUsd: number;
  /** Suma de los que están en «Pagado». */
  montoPagadoUsd: number;
  /** Aceptados que todavía no están en «Pagado». */
  montoPorCobrarUsd: number;
};

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function centimos(n: number): number {
  return Math.round(n * 100) / 100;
}

export function presupuestoAceptado(status: string | null | undefined): boolean {
  return (ESTADOS_PRESUPUESTO_ACEPTADO as readonly string[]).includes(String(status ?? '').trim());
}

export function etiquetaEstadoPresupuesto(status: string | null | undefined): string {
  const s = String(status ?? '').trim();
  return ETIQUETAS_ESTADO[s] ?? (s || 'Sin estado');
}

export function tonoEstadoPresupuesto(status: string | null | undefined): TonoEstadoPresupuesto {
  return TONOS_ESTADO[String(status ?? '').trim()] ?? 'gris';
}

export function normalizarPresupuestosCliente(filas: unknown): PresupuestoCliente[] {
  if (!Array.isArray(filas)) return [];
  return filas
    .map((f) => {
      const r = (f ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id ?? '').trim(),
        subtotal: numero(r.subtotal),
        status: String(r.status ?? '').trim(),
        created_at: typeof r.created_at === 'string' && r.created_at ? r.created_at : null,
      };
    })
    .filter((p) => p.id);
}

export function resumenPresupuestosCliente(presupuestos: PresupuestoCliente[]): ResumenPresupuestosCliente {
  let aceptados = 0;
  let montoAceptado = 0;
  let montoPagado = 0;
  for (const p of presupuestos) {
    if (!presupuestoAceptado(p.status)) continue;
    aceptados += 1;
    montoAceptado += p.subtotal;
    if (p.status === 'pagado') montoPagado += p.subtotal;
  }
  return {
    cantidad: presupuestos.length,
    aceptados,
    montoAceptadoUsd: centimos(montoAceptado),
    montoPagadoUsd: centimos(montoPagado),
    montoPorCobrarUsd: centimos(montoAceptado - montoPagado),
  };
}

/** Presupuestos del cliente, del más reciente al más antiguo. */
export async function cargarPresupuestosCliente(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ presupuestos: PresupuestoCliente[]; error: string | null }> {
  const id = customerId.trim();
  if (!id) return { presupuestos: [], error: null };
  const { data, error } = await supabase
    .from('budgets')
    .select('id,subtotal,status,created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });
  if (error) return { presupuestos: [], error: error.message };
  return { presupuestos: normalizarPresupuestosCliente(data), error: null };
}

export type VinculosCliente = { presupuestos: number; obras: number };

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * Por qué no se puede borrar el cliente, o `null` si se puede.
 * Un cliente con presupuestos u obras se conserva: al borrarlo esos documentos
 * quedarían sin dueño.
 */
export function motivoNoBorrarCliente(vinculos: VinculosCliente): string | null {
  const partes: string[] = [];
  if (vinculos.presupuestos > 0) partes.push(plural(vinculos.presupuestos, 'presupuesto', 'presupuestos'));
  if (vinculos.obras > 0) partes.push(plural(vinculos.obras, 'obra', 'obras'));
  if (partes.length === 0) return null;
  return `No se puede eliminar: este cliente tiene ${partes.join(' y ')}. Sus documentos quedarían sin cliente.`;
}

/** Cuántos presupuestos y obras tiene el cliente. Si no se puede saber, devuelve el error. */
export async function contarVinculosCliente(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ vinculos: VinculosCliente; error: string | null }> {
  const id = customerId.trim();
  const [pres, obras] = await Promise.all([
    supabase.from('budgets').select('id').eq('customer_id', id),
    supabase.from('ci_proyectos').select('id').eq('customer_id', id),
  ]);
  const error = pres.error?.message ?? obras.error?.message ?? null;
  return {
    vinculos: {
      presupuestos: Array.isArray(pres.data) ? pres.data.length : 0,
      obras: Array.isArray(obras.data) ? obras.data.length : 0,
    },
    error,
  };
}

/**
 * Número para abrir un chat de WhatsApp (solo dígitos, con código de país).
 * Los celulares venezolanos escritos como 0414… o 414… se completan con 58.
 */
export function numeroWhatsapp(telefono: string | null | undefined): string | null {
  const d = String(telefono ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (d.length === 11 && d.startsWith('0')) return `58${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('4')) return `58${d}`;
  if (d.startsWith('00')) return d.slice(2);
  return d;
}
