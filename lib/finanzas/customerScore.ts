import type { SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Score fidelidad 0-100:
 * - Volumen financiero: 50%
 * - Recurrencia (12m): 30%
 * - Lealtad (antigüedad): 20%
 */
export async function calculateCustomerLoyaltyScore(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerScoreResult> {
  const id = customerId.trim();
  if (!id) {
    throw new Error('customerId requerido');
  }

  const now = new Date();
  const since12m = new Date(now);
  since12m.setMonth(since12m.getMonth() - 12);

  const [customerRes, budgetsRes, proyectosRes, ventasRes] = await Promise.all([
    supabase.from('customers').select('id,created_at,rif').eq('id', id).maybeSingle(),
    supabase
      .from('budgets')
      .select('id,total,subtotal,grand_total,status,created_at')
      .eq('customer_id', id)
      .eq('status', 'aprobado'),
    supabase
      .from('ci_proyectos')
      .select('*')
      .eq('customer_id', id),
    supabase.from('ventas').select('id,importe_total,fecha,empresa_id').neq('estado', 'cancelada'),
  ]);

  if (customerRes.error || !customerRes.data) {
    throw new Error(customerRes.error?.message ?? 'Cliente no encontrado');
  }

  const customer = customerRes.data as { created_at?: string | null; rif?: string | null };

  const presupuestoAprobadoRows = (budgetsRes.data ?? []) as Array<{
    id: string;
    total?: unknown;
    subtotal?: unknown;
    grand_total?: unknown;
    created_at?: string | null;
  }>;
  const proyectosRows = (proyectosRes.data ?? []) as Array<{
    id: string;
    monto_aproximado?: unknown;
    obra_precio_venta_usd?: unknown;
    created_at?: string | null;
  }>;

  const ventasRows = (ventasRes.data ?? []) as Array<{
    id: string;
    importe_total?: unknown;
    fecha?: string | null;
    empresa_id?: string | null;
  }>;

  // Matching ventas legacy (empresa_id) -> cliente jurídico unificado por RIF.
  let ventasMatched: typeof ventasRows = [];
  const rif = (customer.rif ?? '').trim().toLowerCase();
  if (rif) {
    const [empRes, empDepRes] = await Promise.all([
      supabase.from('empresas').select('id,rif'),
      supabase.from('empresas_deprecated').select('id,rif'),
    ]);

    const empresas = [...(empRes.data ?? []), ...(empDepRes.data ?? [])] as Array<{ id?: string; rif?: string | null }>;
    const empresaIds = new Set(
      empresas
        .filter((e) => (e.rif ?? '').trim().toLowerCase() === rif && e.id)
        .map((e) => String(e.id)),
    );
    ventasMatched = ventasRows.filter((v) => (v.empresa_id ? empresaIds.has(v.empresa_id) : false));
  }

  const totalBudgetsUsd = presupuestoAprobadoRows.reduce((acc, r) => {
    const v = num((r as { grand_total?: unknown }).grand_total);
    if (v > 0) return acc + v;
    const t = num((r as { total?: unknown }).total);
    if (t > 0) return acc + t;
    return acc + num((r as { subtotal?: unknown }).subtotal);
  }, 0);

  const totalProyectosUsd = proyectosRows.reduce(
    (acc, r) => acc + Math.max(num(r.obra_precio_venta_usd), num(r.monto_aproximado)),
    0,
  );

  const totalVentasUsd = ventasMatched.reduce((acc, r) => acc + num(r.importe_total), 0);
  const volumenFinancieroUsd = totalBudgetsUsd + totalProyectosUsd + totalVentasUsd;

  const recurrenciaProyectos = proyectosRows.filter((r) => {
    if (!r.created_at) return false;
    return new Date(r.created_at) >= since12m;
  }).length;
  const recurrenciaVentas = ventasMatched.filter((r) => {
    if (!r.fecha) return false;
    return new Date(r.fecha) >= since12m;
  }).length;
  const recurrencia12m = recurrenciaProyectos + recurrenciaVentas;

  const createdAt = customer.created_at ? new Date(customer.created_at) : now;
  const antiguedadMeses = monthsBetween(createdAt, now);

  // Normalización de sub-scores con topes razonables de negocio.
  const scoreVolumen = clamp((volumenFinancieroUsd / 100_000) * 100, 0, 100); // 100k USD histórico ~ score max
  const scoreRecurrencia = clamp((recurrencia12m / 12) * 100, 0, 100); // 12 operaciones/año ~ score max
  const scoreLealtad = clamp((antiguedadMeses / 60) * 100, 0, 100); // 5 años ~ score max

  const weighted =
    scoreVolumen * 0.5 +
    scoreRecurrencia * 0.3 +
    scoreLealtad * 0.2;

  const score = Math.round(clamp(weighted, 0, 100));

  return {
    customerId: id,
    score,
    tier: loyaltyTierFromScore(score),
    breakdown: {
      ltvTotalUsd: volumenFinancieroUsd,
      volumenFinancieroUsd,
      recurrencia12m,
      antiguedadMeses,
      proyectosContribuyentes: proyectosRows.length,
      ventasContribuyentes: ventasMatched.length,
      presupuestosAprobadosContribuyentes: presupuestoAprobadoRows.length,
      scoreVolumen,
      scoreRecurrencia,
      scoreLealtad,
    },
  };
}
