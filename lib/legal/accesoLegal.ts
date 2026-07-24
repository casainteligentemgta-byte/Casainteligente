/**
 * Acceso al producto Departamento Legal (separado del CRM de obras).
 * - Integrado: Casa Inteligente (plan owner) — Legal dentro del CRM.
 * - Standalone: terceros / despachos (trial|solo|equipo|estudio) — solo módulo abogado.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Dueño del programa: acceso integrado Casa Inteligente. */
export const LEGAL_OWNER_EMAILS = new Set(
  [
    'casainteligentemgta@gmail.com',
    ...(process.env.LEGAL_OWNER_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ].map((e) => e.toLowerCase()),
);

export const LEGAL_ORG_OWNER_ID = 'a0000000-0000-4000-8000-000000000001';

export const LEGAL_PLANES = [
  'owner',
  'trial',
  'solo',
  'equipo',
  'estudio',
] as const;

export type LegalPlan = (typeof LEGAL_PLANES)[number];

/** Producto solo-abogado (sin CRM de obras). */
export type LegalModoProducto = 'integrado' | 'standalone';

export type AccesoLegal = {
  ok: boolean;
  motivo: 'owner' | 'entitlement' | 'none';
  orgId: string | null;
  rolLegal: string | null;
  plan: LegalPlan | null;
  orgNombre: string | null;
  /** integrado = Casa Inteligente; standalone = despacho / tercero. */
  modoProducto: LegalModoProducto;
};

export function emailEsDuenioLegal(email?: string | null): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return Boolean(e) && LEGAL_OWNER_EMAILS.has(e);
}

export function esPlanLegalStandalone(plan: string | null | undefined): boolean {
  return plan === 'trial' || plan === 'solo' || plan === 'equipo' || plan === 'estudio';
}

export function modoProductoDesdePlan(plan: string | null | undefined): LegalModoProducto {
  return esPlanLegalStandalone(plan) ? 'standalone' : 'integrado';
}

export async function resolverAccesoLegal(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<AccesoLegal> {
  if (emailEsDuenioLegal(email)) {
    return {
      ok: true,
      motivo: 'owner',
      orgId: LEGAL_ORG_OWNER_ID,
      rolLegal: 'admin',
      plan: 'owner',
      orgNombre: 'Casa Inteligente — Departamento Legal',
      modoProducto: 'integrado',
    };
  }

  const { data, error } = await supabase
    .from('ci_legal_entitlements')
    .select(
      'org_id, rol_legal, activo, ci_legal_orgs!inner(id, nombre, status, plan, valido_hasta)',
    )
    .eq('user_id', userId)
    .eq('activo', true)
    .limit(5);

  if (error || !data?.length) {
    return {
      ok: false,
      motivo: 'none',
      orgId: null,
      rolLegal: null,
      plan: null,
      orgNombre: null,
      modoProducto: 'integrado',
    };
  }

  const now = Date.now();
  for (const row of data as Array<{
    org_id: string;
    rol_legal: string;
    activo: boolean;
    ci_legal_orgs:
      | {
          id: string;
          nombre: string;
          status: string;
          plan: string;
          valido_hasta: string | null;
        }
      | {
          id: string;
          nombre: string;
          status: string;
          plan: string;
          valido_hasta: string | null;
        }[]
      | null;
  }>) {
    const org = Array.isArray(row.ci_legal_orgs) ? row.ci_legal_orgs[0] : row.ci_legal_orgs;
    if (!org || org.status !== 'active') continue;
    if (org.valido_hasta && new Date(org.valido_hasta).getTime() < now) continue;
    const plan = (LEGAL_PLANES as readonly string[]).includes(org.plan)
      ? (org.plan as LegalPlan)
      : 'trial';
    return {
      ok: true,
      motivo: 'entitlement',
      orgId: row.org_id,
      rolLegal: row.rol_legal,
      plan,
      orgNombre: org.nombre ?? null,
      modoProducto: modoProductoDesdePlan(plan),
    };
  }

  return {
    ok: false,
    motivo: 'none',
    orgId: null,
    rolLegal: null,
    plan: null,
    orgNombre: null,
    modoProducto: 'integrado',
  };
}
