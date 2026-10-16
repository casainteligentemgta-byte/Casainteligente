import { NextResponse } from 'next/server';
import { validarExpedienteToken } from '@/lib/reclutamiento/validarExpedienteToken';
import { bloqueoHojaVidaExamenPrimero, type SemaforoEvaluacion } from '@/lib/reclutamiento/examenPrimero';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * POST { token } — Valida enlace de expediente / onboarding.
 * Respuesta: { valid: true, empleado: { nombre, cargo } } o error 404 / 410.
 */
export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ valid: false, error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const out = await validarExpedienteToken(admin.client, token);
  if (!out.valid) {
    return NextResponse.json({ valid: false, error: out.error }, { status: out.status });
  }

  // Vacantes con «examen primero»: la hoja de vida solo se abre tras aprobar la evaluación.
  const { data: emp } = await admin.client
    .from('ci_empleados')
    .select('recruitment_need_id, estado_proceso, estatus_evaluacion, semaforo')
    .eq('id', out.empleadoId)
    .maybeSingle();
  const e = emp as {
    recruitment_need_id?: string | null;
    estado_proceso?: string | null;
    estatus_evaluacion?: string | null;
    semaforo?: SemaforoEvaluacion;
  } | null;
  const needId = (e?.recruitment_need_id ?? '').trim();
  if (e && needId && e.estado_proceso !== 'cv_completado') {
    const { data: need } = await admin.client
      .from('recruitment_needs')
      .select('examen_primero')
      .eq('id', needId)
      .maybeSingle();
    const bloqueo = bloqueoHojaVidaExamenPrimero({
      examenPrimero: Boolean((need as { examen_primero?: boolean | null } | null)?.examen_primero),
      estatusEvaluacion: e.estatus_evaluacion,
      semaforo: e.semaforo,
    });
    if (bloqueo) {
      return NextResponse.json({ valid: false, error: bloqueo }, { status: 403 });
    }
  }

  return NextResponse.json({
    valid: true,
    empleado: out.empleado,
    empleadoId: out.empleadoId,
    source: out.source,
  });
}
