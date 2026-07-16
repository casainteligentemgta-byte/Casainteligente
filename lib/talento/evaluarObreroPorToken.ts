import type { SupabaseClient } from '@supabase/supabase-js';
import { PREGUNTAS_OBRERO } from '@/lib/talento/exam';
import { evaluarSemaforoObrero } from '@/lib/talento/evaluarSemaforoObrero';

export type EvaluarObreroPorTokenInput = {
  token: string;
  rol: string;
  respuestas: Record<string, string>;
};

export type EvaluarObreroPorTokenOk = {
  success: true;
  id: string;
  semaforo: string;
  statusEvaluacion: string;
  estado: string;
  motivo: string;
  resumen: { respuestasA: number; respuestasB: number; respuestasC: number };
};

export type EvaluarObreroPorTokenErr = { error: string; status: number };

/**
 * Evalúa obrero/vigilante por invitación (token) y persiste en `ci_empleados`.
 */
export async function evaluarObreroPorToken(
  admin: SupabaseClient,
  input: EvaluarObreroPorTokenInput,
): Promise<EvaluarObreroPorTokenOk | EvaluarObreroPorTokenErr> {
  const token = input.token.trim();
  const rol = input.rol.trim().toLowerCase();
  const respuestas = input.respuestas ?? {};

  if (!token) return { error: 'token requerido', status: 400 };
  if (rol !== 'obrero' && rol !== 'vigilante') {
    return { error: 'Este flujo es solo para obrero o vigilante', status: 400 };
  }

  const { data: inv, error: invErr } = await admin
    .from('ci_examenes')
    .select('empleado_id, expira_at, usado_at, completado')
    .eq('token', token)
    .maybeSingle();

  if (invErr) return { error: invErr.message, status: 500 };
  if (!inv) return { error: 'Invitación no válida', status: 403 };

  const invR = inv as {
    empleado_id: string;
    expira_at: string;
    usado_at: string | null;
    completado?: boolean;
  };

  if (invR.completado) {
    return { error: 'La evaluación ya se cerró por tiempo', status: 409 };
  }
  if (invR.usado_at) {
    return { error: 'Esta invitación ya fue utilizada', status: 409 };
  }
  if (Date.now() > new Date(invR.expira_at).getTime()) {
    return { error: 'Invitación expirada', status: 410 };
  }

  if (Object.keys(respuestas).length < PREGUNTAS_OBRERO.length) {
    return {
      error: `Completa las ${PREGUNTAS_OBRERO.length} preguntas`,
      status: 400,
    };
  }

  const { data: emp, error: empErr } = await admin
    .from('ci_empleados')
    .select('id, rol_examen')
    .eq('id', invR.empleado_id)
    .maybeSingle();

  if (empErr || !emp) return { error: 'Empleado no encontrado', status: 404 };

  const empRol = ((emp as { rol_examen?: string }).rol_examen ?? '').trim().toLowerCase();
  if (empRol !== 'obrero' && empRol !== 'vigilante') {
    return { error: 'El empleado no tiene rol de examen obrero/vigilante', status: 409 };
  }

  const resultado = evaluarSemaforoObrero(respuestas);
  const ahora = new Date().toISOString();

  const { error: upErr } = await admin
    .from('ci_empleados')
    .update({
      respuestas_personalidad: respuestas,
      respuestas_logica: {},
      puntaje_personalidad: resultado.puntaje_personalidad,
      puntaje_logica: 0,
      puntaje_total: resultado.puntaje_total,
      gma_0_5: 0,
      nivel_integridad_riesgo: 0,
      motivo_semaforo: resultado.motivo,
      status_evaluacion: resultado.status_evaluacion,
      semaforo: resultado.semaforo,
      estado: resultado.estado,
      examen_completado_at: ahora,
      updated_at: ahora,
    } as never)
    .eq('id', invR.empleado_id);

  if (upErr) return { error: upErr.message, status: 500 };

  await admin
    .from('ci_examenes')
    .update({ usado_at: ahora } as never)
    .eq('token', token)
    .eq('empleado_id', invR.empleado_id);

  return {
    success: true,
    id: invR.empleado_id,
    semaforo: resultado.semaforo,
    statusEvaluacion: resultado.status_evaluacion,
    estado: resultado.estado,
    motivo: resultado.motivo,
    resumen: resultado.resumen,
  };
}
