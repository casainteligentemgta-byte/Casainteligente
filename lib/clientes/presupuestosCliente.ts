/**
 * Presupuestos de un cliente: lo que la ficha muestra y lo que decide si se puede borrar.
 *
 * Funciones puras más dos lecturas que reciben el cliente de Supabase, para poder
 * probarlas sin navegador.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { redondearUsd } from '@/lib/presupuesto/cobros';
import { cargarMontoPagadoPorPresupuesto } from '@/lib/clientes/cobrosCliente';
import { numeroWhatsapp as numeroWhatsappHelper } from '@/lib/clientes/numeroWhatsapp';

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
  /** Abonos reales (budget_abonos) o budgets.monto_pagado. 0 si no hay. */
  montoPagadoUsd: number;
};

export type ResumenPresupuestosCliente = {
  cantidad: number;
  aceptados: number;
  /** Suma de los aceptados (aprobado, por pagar, pago parcial y pagado). */
  montoAceptadoUsd: number;
  /** Suma de abonos reales (o subtotal si el estado es pagado y no hay abonos). */
  montoPagadoUsd: number;
  /** Aceptados menos abonos reales. */
  montoPorCobrarUsd: number;
};

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function centimos(n: number): number {
  return redondearUsd(n);
}

/**
 * Pagado real: abonos si hay; si el estado es «pagado» y no hay abonos (datos viejos),
 * se toma el subtotal para no romper fichas ya cobradas.
 */
export function montoPagadoEfectivo(p: Pick<PresupuestoCliente, 'subtotal' | 'status' | 'montoPagadoUsd'>): number {
  const pagado = centimos(p.montoPagadoUsd);
  if (pagado > 0) return pagado;
  if (p.status === 'pagado') return centimos(p.subtotal);
  return 0;
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
        montoPagadoUsd: centimos(numero(r.monto_pagado ?? r.montoPagadoUsd)),
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
    const pagado = montoPagadoEfectivo(p);
    const tope = centimos(p.subtotal);
    montoPagado += tope > 0 ? Math.min(pagado, tope) : pagado;
  }
  const aceptado = centimos(montoAceptado);
  const pagado = centimos(montoPagado);
  return {
    cantidad: presupuestos.length,
    aceptados,
    montoAceptadoUsd: aceptado,
    montoPagadoUsd: pagado,
    montoPorCobrarUsd: centimos(Math.max(0, aceptado - pagado)),
  };
}

/** Presupuestos del cliente, del más reciente al más antiguo. */
export async function cargarPresupuestosCliente(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ presupuestos: PresupuestoCliente[]; error: string | null }> {
  const id = customerId.trim();
  if (!id) return { presupuestos: [], error: null };
  const first = await supabase
    .from('budgets')
    .select('id,subtotal,status,created_at,monto_pagado')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  let filas: unknown = first.data;
  let error = first.error;
  if (error && /monto_pagado|does not exist|schema cache/i.test(error.message)) {
    const second = await supabase
      .from('budgets')
      .select('id,subtotal,status,created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });
    filas = second.data;
    error = second.error;
  }
  if (error) return { presupuestos: [], error: error.message };

  const presupuestos = normalizarPresupuestosCliente(filas);
  const porAbono = await cargarMontoPagadoPorPresupuesto(
    supabase,
    presupuestos.map((p) => p.id),
  );
  if (porAbono.size) {
    for (const p of presupuestos) {
      const real = porAbono.get(p.id);
      if (real != null && real > 0) p.montoPagadoUsd = real;
    }
  }
  return { presupuestos, error: null };
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

/** @deprecated importar desde `@/lib/clientes/numeroWhatsapp`. Se reexporta para no romper imports. */
export const numeroWhatsapp = numeroWhatsappHelper;
