import { NextResponse } from 'next/server';
import { bancoEvaluacionUnificadaObrero } from '@/lib/talento/bancoEvaluacionUnificadaObrero';
import {
  colorPredominanteDisc,
  esColorPerfilObrero,
  puntajeConfiabilidadObrero,
  puntajeLogicaObrero,
  type ColorPerfilObrero,
} from '@/lib/talento/evaluacionObrero';
import { calcularRiesgoObrero } from '@/lib/talento/calcularRiesgoObrero';
import { evaluarSemaforoObrero } from '@/lib/talento/evaluarSemaforoObrero';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST — Evaluación única de ingreso (color + lógica + honestidad + ABC oficio).
 * Body: { token, disc, logica?, confiabilidad, abc, tiempo_respuesta? }
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: {
    token?: string;
    disc?: Record<string, string>;
    logica?: Record<string, number>;
    confiabilidad?: Record<string, number>;
    abc?: Record<string, string>;
    tiempo_respuesta?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 });

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
  if (invR.usado_at) {
    return NextResponse.json({ error: 'Esta invitación ya fue utilizada' }, { status: 409 });
  }
  if (Date.now() > new Date(invR.expira_at).getTime()) {
    return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 });
  }

  const { data: emp, error: empErr } = await admin.client
    .from('ci_empleados')
    .select('id, rol_examen, rol_buscado, cargo, cargo_codigo')
    .eq('id', invR.empleado_id)
    .maybeSingle();

  if (empErr || !emp) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const empRow = emp as {
    rol_examen?: string;
    rol_buscado?: string | null;
    cargo?: string | null;
    cargo_codigo?: string | null;
  };
  const empRol = (empRow.rol_examen ?? '').trim().toLowerCase() || 'obrero';
  if (empRol !== 'obrero' && empRol !== 'vigilante') {
    return NextResponse.json(
      { error: 'Esta evaluación unificada es para obrero o vigilante' },
      { status: 409 },
    );
  }

  const banco = bancoEvaluacionUnificadaObrero({
    cargo: empRow.rol_buscado || empRow.cargo,
    rolExamen: empRol,
    codigoGoE: empRow.cargo_codigo,
    incluirLogica: true,
  });

  const disc = body.disc ?? {};
  for (const q of banco.disc) {
    if (!esColorPerfilObrero(disc[q.id] ?? '')) {
      return NextResponse.json({ error: `Falta respuesta de color (${q.id})` }, { status: 400 });
    }
  }

  const logica = body.logica ?? {};
  for (const q of banco.logica) {
    const v = logica[q.id];
    if (typeof v !== 'number' || v < 0 || v > 3) {
      return NextResponse.json({ error: `Falta respuesta lógica (${q.id})` }, { status: 400 });
    }
  }

  const conf = body.confiabilidad ?? {};
  for (const q of banco.confiabilidad) {
    const v = conf[q.id];
    if (typeof v !== 'number' || v < 0 || v > 2) {
      return NextResponse.json({ error: `Falta respuesta de honestidad (${q.id})` }, { status: 400 });
    }
  }

  const abc = body.abc ?? {};
  for (const q of banco.abc) {
    const v = String(abc[q.id] ?? '')
      .trim()
      .toUpperCase();
    if (v !== 'A' && v !== 'B' && v !== 'C') {
      return NextResponse.json({ error: `Falta respuesta ABC (${q.id})` }, { status: 400 });
    }
  }

  const perfil_color = colorPredominanteDisc(disc) as ColorPerfilObrero;
  const { porcentaje: puntuacion_logica, correctas } = puntajeLogicaObrero(logica, banco.logica);
  const { porcentaje: puntuacion_confiabilidad } = puntajeConfiabilidadObrero(
    conf,
    banco.confiabilidad,
  );
  const totalL = banco.logica.length;
  const gma_0_5 =
    totalL === 0 ? 0 : Math.min(5, Math.max(0, Math.round((correctas / totalL) * 5)));
  const nivel_integridad_riesgo =
    Math.round(10 * (1 - puntuacion_confiabilidad / 100) * 100) / 100;

  const tiempo =
    typeof body.tiempo_respuesta === 'number' && body.tiempo_respuesta >= 0
      ? Math.round(body.tiempo_respuesta)
      : null;

  const riesgo = calcularRiesgoObrero({
    perfil_color,
    puntuacion_logica,
    tiempo_respuesta: tiempo,
  });
  const semaforoRiesgo = riesgo.nivel === 'sin_datos' ? null : riesgo.nivel;

  const abcResult = evaluarSemaforoObrero(abc);
  const ahora = new Date().toISOString();

  const { error: upErr } = await admin.client
    .from('ci_empleados')
    .update({
      perfil_color,
      color_disc: perfil_color,
      puntuacion_logica,
      puntuacion_confiabilidad,
      gma_0_5,
      nivel_integridad_riesgo,
      tiempo_respuesta: tiempo,
      estatus_evaluacion: 'completado',
      evaluacion_obrero_respuestas: {
        disc,
        logica,
        confiabilidad: conf,
        abc,
        familia: banco.familia,
        unificada: true,
      } as never,
      semaforo_riesgo: semaforoRiesgo,
      motivo_semaforo_riesgo: riesgo.tooltip || null,
      respuestas_personalidad: abc,
      respuestas_logica: {},
      puntaje_personalidad: abcResult.puntaje_personalidad,
      puntaje_logica: 0,
      puntaje_total: abcResult.puntaje_total,
      motivo_semaforo: abcResult.motivo,
      status_evaluacion: abcResult.status_evaluacion,
      semaforo: abcResult.semaforo,
      estado: abcResult.estado,
      examen_completado_at: ahora,
      updated_at: ahora,
    } as never)
    .eq('id', invR.empleado_id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.client
    .from('ci_examenes')
    .update({ usado_at: ahora } as never)
    .eq('token', token)
    .eq('empleado_id', invR.empleado_id);

  return NextResponse.json({
    success: true,
    empleado_id: invR.empleado_id,
    total_preguntas: banco.total,
    familia: banco.familia,
    // Resultados no se muestran al obrero; se devuelven por si RRHH/debug.
    perfil_color,
    semaforo: abcResult.semaforo,
  });
}
