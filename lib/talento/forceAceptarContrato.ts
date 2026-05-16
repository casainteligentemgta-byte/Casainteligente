import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export async function forceAceptarContrato(empleadoId: string, adminId: string, motivo: string) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) throw new Error('No se pudo inicializar el cliente de admin');

  // 1. Buscar el contrato pendiente para ese empleado
  const { data: contrato, error: selError } = await admin.client
    .from('ci_contratos_empleado_obra')
    .select('id')
    .eq('empleado_id', empleadoId)
    .eq('estado_contrato', 'generado')
    .maybeSingle();

  if (selError) throw selError;
  if (!contrato) throw new Error('No se encontró un contrato pendiente para este empleado.');

  // 2. Esta función simula la aceptación pero audita que fue un Bypass
  const { data, error } = await (admin.client
    .from('ci_contratos_empleado_obra')
    .update({
      estado_contrato: 'firmado_electronico',
      obrero_aceptacion_contrato_at: new Date().toISOString(),
      obrero_aceptacion_cliente: {
        bypass_by_admin: true,
        admin_id: adminId,
        motivo: motivo || "Aceptación manual / Desatasco de flujo en pruebas"
      }
    } as never) as any)
    .eq('id', (contrato as any).id)
    .select();

  return { data, error };
}
