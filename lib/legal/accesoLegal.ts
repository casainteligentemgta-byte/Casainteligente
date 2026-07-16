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

export function emailEsDuenioLegal(email?: string | null): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return Boolean(e) && LEGAL_OWNER_EMAILS.has(e);
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
  for (const row of data as Array<{
    org_id: string;
    rol_legal: string;
    activo: boolean;
    ci_legal_orgs:
      | { status: string; plan: string; valido_hasta: string | null }
      | { status: string; plan: string; valido_hasta: string | null }[]
      | null;
  }>) {
    const org = Array.isArray(row.ci_legal_orgs) ? row.ci_legal_orgs[0] : row.ci_legal_orgs;
    if (!org || org.status !== 'active') continue;
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
