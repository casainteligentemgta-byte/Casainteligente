import type { SupabaseClient } from '@supabase/supabase-js';

export type ContratoObreroTokenOk = {
  ok: true;
  contratoId: string;
  empleadoId: string;
  estadoContrato: string;
  obreroAceptacionContratoAt: string | null;
};

export type ContratoObreroTokenErr = { ok: false; error: string; status: number };

/**
 * Valida que `token` coincida con `ci_empleados.token_registro` del titular del contrato.
 */
export async function contratoObreroPorToken(
  admin: SupabaseClient,
  contratoId: string,
  token: string,
): Promise<ContratoObreroTokenOk | ContratoObreroTokenErr> {
  const cid = contratoId.trim();
  const tok = token.trim();
  if (!cid || !tok) {
    return { ok: false, error: 'contratoId y token requeridos', status: 400 };
  }

  const { data: c, error: e1 } = await admin
    .from('ci_contratos_empleado_obra')
    .select('id, empleado_id, estado_contrato, obrero_aceptacion_contrato_at')
    .eq('id', cid)
    .maybeSingle();

  if (e1) return { ok: false, error: e1.message, status: 500 };
  if (!c) return { ok: false, error: 'Contrato no encontrado', status: 404 };

  const row = c as {
    id: string;
    empleado_id: string;
    estado_contrato?: string | null;
    obrero_aceptacion_contrato_at?: string | null;
  };

  const { data: e, error: e2 } = await admin
    .from('ci_empleados')
    .select('id, token_registro, token')
    .eq('id', row.empleado_id)
    .maybeSingle();

  if (e2 || !e) return { ok: false, error: 'Empleado no encontrado', status: 404 };

  const emp = e as { id: string; token_registro: string | null; token: string | null };
  const regTok = String(emp.token_registro ?? '').trim();
  const legTok = String(emp.token ?? '').trim();
  if (tok !== regTok && tok !== legTok) {
    return { ok: false, error: 'Token inválido', status: 403 };
  }

  return {
    ok: true,
    contratoId: row.id,
    empleadoId: row.empleado_id,
    estadoContrato: String(row.estado_contrato ?? 'generado').trim() || 'generado',
    obreroAceptacionContratoAt: row.obrero_aceptacion_contrato_at ?? null,
  };
}
