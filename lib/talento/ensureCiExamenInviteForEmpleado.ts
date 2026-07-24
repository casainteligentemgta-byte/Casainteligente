import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_DAYS = 7;

/**
 * Garantiza una fila en `ci_examenes` para el empleado (mismo `token` que onboarding / examen en URL).
 * Idempotente: si ya existe invitación para ese `empleado_id`, no inserta de nuevo.
 */
export async function ensureCiExamenInviteForEmpleado(
  admin: SupabaseClient,
  params: { empleadoId: string; token: string; expiraDays?: number },
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const empleadoId = params.empleadoId.trim();
  const token = params.token.trim();
  if (!empleadoId || !token) {
    return { ok: false, error: 'empleadoId y token son obligatorios' };
  }

  const { data: existing, error: exErr } = await admin
    .from('ci_examenes')
    .select('id')
    .eq('empleado_id', empleadoId)
    .limit(1)
    .maybeSingle();

  if (exErr) return { ok: false, error: exErr.message };
  if (existing) return { ok: true, created: false };

  const days = params.expiraDays ?? DEFAULT_DAYS;
  const expiraAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error: insErr } = await admin.from('ci_examenes').insert({
    empleado_id: empleadoId,
    token,
    expira_at: expiraAt,
  } as never);

  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true, created: true };
}
