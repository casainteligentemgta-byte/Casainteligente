import { NextResponse } from 'next/server';
import {
  procesarEvaluacionObrero,
  validarRespuestasCompletasObrero,
  type ColorPerfilObrero,
} from '@/lib/talento/evaluacionObrero';
import { calcularRiesgoObrero } from '@/lib/talento/calcularRiesgoObrero';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST — Evaluación de tipo de color (DISC) + lógica + confiabilidad para obrero.
 * Body: { token, disc, logica, confiabilidad, tiempo_respuesta? }
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: {
    token?: string;
    disc?: Record<string, string>;
    logica?: Record<string, number>;
    confiabilidad?: Record<string, number>;
    tiempo_respuesta?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 });

  const validacion = validarRespuestasCompletasObrero({
    disc: body.disc,
    logica: body.logica,
    confiabilidad: body.confiabilidad,
  });
  if (validacion) {
    return NextResponse.json({ error: validacion }, { status: 400 });
  }

  const disc = body.disc as Record<string, string>;
  const logica = body.logica as Record<string, number>;
  const confiabilidad = body.confiabilidad as Record<string, number>;

  const { data: inv, error: invErr } = await admin.client
    .from('ci_examenes')
    .select('empleado_id, expira_at, usado_at, completado')
    .eq('token', token)
    .maybeSingle();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
  if (!inv) return NextResponse.json({ error: 'Invitación no válida' }, { status: 403 });

  const invR = inv as {
    empleado_id: string;
    expira_at: string;
    usado_at: string | null;
    completado?: boolean;
  };

  if (invR.completado) {
    return NextResponse.json({ error: 'La evaluación ya se cerró' }, { status: 409 });
  }
  if (Date.now() > new Date(invR.expira_at).getTime()) {
    return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 });
  }

  const scores = procesarEvaluacionObrero({ disc, logica, confiabilidad });
  const tiempo =
    typeof body.tiempo_respuesta === 'number' && body.tiempo_respuesta >= 0
      ? Math.round(body.tiempo_respuesta)
      : null;

  const riesgo = calcularRiesgoObrero({
    perfil_color: scores.perfil_color,
    puntuacion_logica: scores.puntuacion_logica,
    tiempo_respuesta: tiempo,
  });
  const semaforoRiesgo = riesgo.nivel === 'sin_datos' ? null : riesgo.nivel;

  const ahora = new Date().toISOString();
  const patch = {
    perfil_color: scores.perfil_color as ColorPerfilObrero,
    color_disc: scores.perfil_color,
    puntuacion_logica: scores.puntuacion_logica,
    puntuacion_confiabilidad: scores.puntuacion_confiabilidad,
    gma_0_5: scores.gma_0_5,
    nivel_integridad_riesgo: scores.nivel_integridad_riesgo,
    tiempo_respuesta: tiempo,
    estatus_evaluacion: 'completado',
    evaluacion_obrero_respuestas: { disc, logica, confiabilidad } as never,
    semaforo_riesgo: semaforoRiesgo,
    motivo_semaforo_riesgo: riesgo.tooltip || null,
    examen_completado_at: ahora,
  };

  const { error: upErr } = await admin.client
    .from('ci_empleados')
    .update(patch as never)
    .eq('id', invR.empleado_id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    empleado_id: invR.empleado_id,
    perfil_color: scores.perfil_color,
    puntuacion_logica: scores.puntuacion_logica,
    puntuacion_confiabilidad: scores.puntuacion_confiabilidad,
    semaforo_riesgo: semaforoRiesgo,
    motivo: riesgo.tooltip || null,
  });
}
