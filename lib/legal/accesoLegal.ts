/**
 * Acceso al producto Departamento Legal (separado del CRM de obras).
 * Allowlist de dueño + entitlements (base para planes de pago).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Dueño del programa: único icono / acceso en fase 0. */
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

export type AccesoLegal = {
  ok: boolean;
  motivo: 'owner' | 'entitlement' | 'none';
  orgId: string | null;
  rolLegal: string | null;
};

type LegalOrgRel = {
  status: string;
  plan: string;
  valido_hasta: string | null;
};

type LegalEntitlementRow = {
  org_id: string;
  rol_legal: string;
  activo: boolean;
  ci_legal_orgs: LegalOrgRel | LegalOrgRel[] | null;
};

export function emailEsDuenioLegal(email?: string | null): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return Boolean(e) && LEGAL_OWNER_EMAILS.has(e);
}

function pickLegalOrg(rel: LegalOrgRel | LegalOrgRel[] | null): LegalOrgRel | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export async function resolverAccesoLegal(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<AccesoLegal> {
  // Solo en desarrollo local: acceso abierto para iterar sin entitlements.
  if (process.env.NODE_ENV === 'development' && process.env.LEGAL_DEV_BYPASS === '1') {
    return {
      ok: true,
      motivo: 'owner',
      orgId: LEGAL_ORG_OWNER_ID,
      rolLegal: 'admin',
    };
  }

  if (emailEsDuenioLegal(email)) {
    return {
      ok: true,
      motivo: 'owner',
      orgId: LEGAL_ORG_OWNER_ID,
      rolLegal: 'admin',
    };
  }

  const { data, error } = await supabase
    .from('ci_legal_entitlements')
    .select('org_id, rol_legal, activo, ci_legal_orgs!inner(status, plan, valido_hasta)')
    .eq('user_id', userId)
    .eq('activo', true)
    .limit(5);

  if (error || !data?.length) {
    return { ok: false, motivo: 'none', orgId: null, rolLegal: null };
  }

  const now = Date.now();
  const rows = data as unknown as LegalEntitlementRow[];
  for (const row of rows) {
    const org = pickLegalOrg(row.ci_legal_orgs);
    if (!org) continue;
    if (org.status !== 'active') continue;
    if (org.valido_hasta && new Date(org.valido_hasta).getTime() < now) continue;
    return {
      ok: true,
      motivo: 'entitlement',
      orgId: row.org_id,
      rolLegal: row.rol_legal,
    };
  }

  return { ok: false, motivo: 'none', orgId: null, rolLegal: null };
}
