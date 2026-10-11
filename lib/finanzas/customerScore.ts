import type { SupabaseClient } from '@supabase/supabase-js';
import { ESTADOS_PRESUPUESTO_ACEPTADO, presupuestoAceptado } from '@/lib/clientes/presupuestosCliente';

export type CustomerLoyaltyTier = 'Bronce' | 'Silver' | 'Gold' | 'Platinum';

export type CustomerScoreBreakdown = {
  ltvTotalUsd: number;
  volumenFinancieroUsd: number;
  recurrencia12m: number;
  antiguedadMeses: number;
  proyectosContribuyentes: number;
  ventasContribuyentes: number;
  presupuestosAprobadosContribuyentes: number;
  scoreVolumen: number;
  scoreRecurrencia: number;
  scoreLealtad: number;
};

export type CustomerScoreResult = {
  customerId: string;
  score: number;
  tier: CustomerLoyaltyTier;
  breakdown: CustomerScoreBreakdown;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function monthsBetween(a: Date, b: Date): number {
  const ms = Math.max(0, b.getTime() - a.getTime());
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

export function loyaltyTierFromScore(score: number): CustomerLoyaltyTier {
  if (score <= 30) return 'Bronce';
  if (score <= 70) return 'Silver';
  if (score <= 90) return 'Gold';
  return 'Platinum';
}

export type DatosPuntajeCliente = {
  clienteCreadoEn?: string | null;
  presupuestos: Array<{ id: string; subtotal?: unknown; status?: string | null; created_at?: string | null }>;
  obras: Array<{
    id: string;
    monto_aproximado?: unknown;
    obra_precio_venta_usd?: unknown;
    created_at?: string | null;
    budget_id?: string | null;
    budgets_adicionales?: unknown;
  }>;
  ventas: Array<{ id: string; importe_total?: unknown; fecha?: string | null }>;
};

function idsPresupuestoDeObra(obra: DatosPuntajeCliente['obras'][number]): string[] {
  const ids: string[] = [];
  if (obra.budget_id) ids.push(String(obra.budget_id));
  if (Array.isArray(obra.budgets_adicionales)) {
    for (const b of obra.budgets_adicionales) if (b) ids.push(String(b));
  }
  return ids;
}

/**
 * Score fidelidad 0-100:
 * - Volumen financiero: 50%
 * - Recurrencia (12m): 30%
 * - Lealtad (antigüedad): 20%
 *
 * Cuentan los presupuestos que el cliente aceptó (aprobado, por pagar, pago parcial y
 * pagado). Un presupuesto que ya es la base de una obra con monto no se suma otra vez:
 * ese dinero ya está en la obra.
 */
export function calcularPuntajeCliente(
  customerId: string,
  datos: DatosPuntajeCliente,
  now: Date = new Date(),
): CustomerScoreResult {
  const since12m = new Date(now);
  since12m.setMonth(since12m.getMonth() - 12);
  const reciente = (iso: string | null | undefined) => Boolean(iso) && new Date(String(iso)) >= since12m;

  const aceptados = datos.presupuestos.filter((p) => presupuestoAceptado(p.status));

  const yaEnObra = new Set<string>();
  let totalProyectosUsd = 0;
  for (const obra of datos.obras) {
    const monto = Math.max(num(obra.obra_precio_venta_usd), num(obra.monto_aproximado));
    totalProyectosUsd += monto;
    if (monto > 0) for (const b of idsPresupuestoDeObra(obra)) yaEnObra.add(b);
  }

  const sueltos = aceptados.filter((p) => !yaEnObra.has(String(p.id)));
  const totalBudgetsUsd = sueltos.reduce((acc, p) => acc + num(p.subtotal), 0);
  const totalVentasUsd = datos.ventas.reduce((acc, r) => acc + num(r.importe_total), 0);
  const volumenFinancieroUsd = totalBudgetsUsd + totalProyectosUsd + totalVentasUsd;

  const recurrencia12m =
    datos.obras.filter((r) => reciente(r.created_at)).length +
    datos.ventas.filter((r) => reciente(r.fecha)).length +
    sueltos.filter((p) => reciente(p.created_at)).length;

  const createdAt = datos.clienteCreadoEn ? new Date(datos.clienteCreadoEn) : now;
  const antiguedadMeses = monthsBetween(createdAt, now);

  // Normalización de sub-scores con topes razonables de negocio.
  const scoreVolumen = clamp((volumenFinancieroUsd / 100_000) * 100, 0, 100); // 100k USD histórico ~ score max
  const scoreRecurrencia = clamp((recurrencia12m / 12) * 100, 0, 100); // 12 operaciones/año ~ score max
  const scoreLealtad = clamp((antiguedadMeses / 60) * 100, 0, 100); // 5 años ~ score max

  const weighted = scoreVolumen * 0.5 + scoreRecurrencia * 0.3 + scoreLealtad * 0.2;
  const score = Math.round(clamp(weighted, 0, 100));

  return {
    customerId,
    score,
    tier: loyaltyTierFromScore(score),
    breakdown: {
      ltvTotalUsd: volumenFinancieroUsd,
      volumenFinancieroUsd,
      recurrencia12m,
      antiguedadMeses,
      proyectosContribuyentes: datos.obras.length,
      ventasContribuyentes: datos.ventas.length,
      presupuestosAprobadosContribuyentes: aceptados.length,
      scoreVolumen,
      scoreRecurrencia,
      scoreLealtad,
    },
  };
}

export async function calculateCustomerLoyaltyScore(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerScoreResult> {
  const id = customerId.trim();
  if (!id) {
    throw new Error('customerId requerido');
  }

  const [customerRes, budgetsRes, proyectosRes, ventasRes] = await Promise.all([
    supabase.from('customers').select('id,created_at,rif').eq('id', id).maybeSingle(),
    supabase
      .from('budgets')
      .select('id,subtotal,status,created_at')
      .eq('customer_id', id)
      .in('status', [...ESTADOS_PRESUPUESTO_ACEPTADO]),
    supabase.from('ci_proyectos').select('*').eq('customer_id', id),
    supabase.from('ventas').select('id,importe_total,fecha,empresa_id').neq('estado', 'cancelada'),
  ]);

  if (customerRes.error || !customerRes.data) {
    throw new Error(customerRes.error?.message ?? 'Cliente no encontrado');
  }
  // Antes un fallo aquí dejaba el puntaje en cero sin avisar.
  if (budgetsRes.error) {
    throw new Error(`No se pudieron leer los presupuestos: ${budgetsRes.error.message}`);
  }

  const customer = customerRes.data as { created_at?: string | null; rif?: string | null };

  const ventasRows = (ventasRes.data ?? []) as Array<{
    id: string;
    importe_total?: unknown;
    fecha?: string | null;
    empresa_id?: string | null;
  }>;

  // Ventas del registro antiguo (por empresa) → cliente, emparejadas por RIF.
  let ventasMatched: typeof ventasRows = [];
  const rif = (customer.rif ?? '').trim().toLowerCase();
  if (rif && ventasRows.length > 0) {
    const empRes = await supabase.from('empresas').select('id,rif');
    const empresas = (empRes.data ?? []) as Array<{ id?: string; rif?: string | null }>;
    const empresaIds = new Set(
      empresas
        .filter((e) => (e.rif ?? '').trim().toLowerCase() === rif && e.id)
        .map((e) => String(e.id)),
    );
    ventasMatched = ventasRows.filter((v) => (v.empresa_id ? empresaIds.has(v.empresa_id) : false));
  }

  return calcularPuntajeCliente(id, {
    clienteCreadoEn: customer.created_at ?? null,
    presupuestos: (budgetsRes.data ?? []) as DatosPuntajeCliente['presupuestos'],
    obras: (proyectosRes.data ?? []) as DatosPuntajeCliente['obras'],
    ventas: ventasMatched,
  });
}
