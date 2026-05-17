import { aceptarContratoPorAdminBypass } from '@/lib/contratos/rrhhContratoFlow';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

const MOTIVO_BYPASS_DEFAULT = 'Aceptación manual / Desatasco de flujo en pruebas';

/**
 * Simula la aceptación digital con auditoría de bypass admin.
 * Persiste en `ci_contratos_empleado_obra` (no existe tabla `ci_contratos` en este proyecto).
 *
 * @param contratoId - UUID del contrato, o del empleado (último contrato) en flujos legacy fast-list.
 */
export async function forceAceptarContrato(
  contratoId: string,
  adminId: string,
  motivo: string = MOTIVO_BYPASS_DEFAULT,
) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) throw new Error('No se pudo inicializar el cliente de admin');

  const id = contratoId.trim();
  const motivoFinal = motivo.trim() || MOTIVO_BYPASS_DEFAULT;

  let out = await aceptarContratoPorAdminBypass(admin.client, {
    contratoId: id,
    adminId,
    motivo: motivoFinal,
  });

  // Fast-list envía `formalizado_empleado_id` en la ruta `/contratos/[id]/force-aceptar`
  if ('error' in out && out.status === 404) {
    out = await aceptarContratoPorAdminBypass(admin.client, {
      empleadoId: id,
      adminId,
      motivo: motivoFinal,
    });
  }

  if ('error' in out) {
    return { data: null, error: { message: out.error } };
  }

  const { data, error } = await admin.client
    .from('ci_contratos_empleado_obra')
    .select('*')
    .eq('id', out.contratoId)
    .maybeSingle();

  return { data, error };
}
