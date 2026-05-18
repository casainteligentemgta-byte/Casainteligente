import { NextResponse } from 'next/server';
import {
  generarExamenAdaptativo,
  logicaDelExamen,
  personalidadDelExamen,
  nivelIntegridadRiesgo,
  puntajeLogica,
  puntajePersonalidad,
  puntajeTotal,
} from '@/lib/talento/exam';
import { evaluarObreroPorToken } from '@/lib/talento/evaluarObreroPorToken';
import { esRolEvaluacionExamen } from '@/lib/talento/evaluarSemaforoObrero';
import {
  calcularSemaforoTalento,
  estadoContratacionFromTripode,
  semaforoDbFromTripode,
} from '@/lib/talento/semaphore';
import { nombresLegadoDesdeTextoLibre } from '@/lib/registro/ciEmpleadosNombresLegado';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { supabaseForRoute } from '@/lib/talento/supabase-route';
import { notifyTalentoWhatsAppExpiracion } from '@/lib/talento/whatsapp';
import type { RolExamen } from '@/types/talento';

const QUINCE_MIN_MS = 15 * 60 * 1000;
const GRACIA_MS = 90 * 1000;

const HINT_CI_EMPLEADOS =
  'Ejecuta en Supabase (SQL Editor) supabase/manual_ci_empleados_solo.sql o las migraciones 025–028. Luego Project Settings → API → Reload schema.';

/**
 * POST — Evaluación automatizada unificada.
 *
 * Flujo obrero/vigilante (FormularioEvaluacion):
 * ```json
 * {
 *   "token": "token_unico_del_obrero",
 *   "rol": "obrero",
 *   "respuestas": {
 *     "obr_01": "A",
 *     "obr_02": "A",
 *     "obr_03": "B",
 *     "obr_04": "A",
 *     "obr_20": "C"
 *   }
 * }
 * ```
 * Claves `obr_01`…`obr_20`; valores `"A"` | `"B"` | `"C"`.
 * Si `respuestas` está vacío → `{ success: true, semaforo: "rojo", statusEvaluacion: "pendiente_regularizar" }`.
 * Con 20 respuestas → semáforo ABC, guardado en `ci_empleados` e invitación marcada usada.
 *
 * programador | técnico: examen completo vía `submit` o body legacy abajo.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      respuestas?: Record<string, string>;
      rol?: string;
      empleado_id?: string;
      nombre_completo?: string;
      email?: string;
      documento?: string;
      telefono?: string;
      rol_examen?: RolExamen;
      examen_inicio_at?: string;
      respuestas_personalidad?: Record<string, number>;
      respuestas_logica?: Record<string, number>;
      color_disc?: string | null;
      rol_buscado?: string | null;
    };

    const token = (body.token ?? '').trim();
    const rolToken = (body.rol ?? '').trim().toLowerCase();
    const respuestasToken = body.respuestas;

    if (token || respuestasToken !== undefined || rolToken) {
      if (!token || !rolToken) {
        return NextResponse.json(
          { error: 'token y rol son requeridos' },
          { status: 400 },
        );
      }

      const respuestas = respuestasToken ?? {};
      if (Object.keys(respuestas).length === 0) {
        return NextResponse.json({
          success: true,
          semaforo: 'rojo',
          statusEvaluacion: 'pendiente_regularizar',
        });
      }

      if (!esRolEvaluacionExamen(rolToken)) {
        return NextResponse.json(
          { error: 'Rol no apto para evaluación automatizada' },
          { status: 400 },
        );
      }

      if (rolToken === 'programador' || rolToken === 'tecnico') {
        return NextResponse.json(
          {
            error:
              'Programador y técnico deben completar el examen de personalidad + lógica en /talento/examen (submit).',
          },
          { status: 400 },
        );
      }

      const admin = supabaseAdminForRoute();
      if (!admin.ok) return admin.response;

      const out = await evaluarObreroPorToken(admin.client, {
        token,
        rol: rolToken,
        respuestas,
      });

      if ('error' in out) {
        return NextResponse.json({ error: out.error }, { status: out.status });
      }

      return NextResponse.json({
        success: true,
        semaforo: out.semaforo,
        statusEvaluacion: out.statusEvaluacion,
        estado: out.estado,
        motivo: out.motivo,
        resumen: out.resumen,
        id: out.id,
      });
    }

    const sb = supabaseForRoute();
    if (!sb.ok) return sb.response;
    const supabase = sb.client;

    const empleadoId = (body.empleado_id ?? '').trim();
    const nombre = (body.nombre_completo ?? '').trim();
    const rol = (body.rol_examen ?? '').trim();
    const rolBuscado = (body.rol_buscado ?? '').trim() || null;
    const inicioIso = body.examen_inicio_at;
    const rp = body.respuestas_personalidad ?? {};
    const rl = body.respuestas_logica ?? {};

    if (!empleadoId) {
      return NextResponse.json({ error: 'empleado_id requerido' }, { status: 400 });
    }
    if (rol !== 'programador' && rol !== 'tecnico') {
      return NextResponse.json(
        { error: 'Rol no apto para evaluación automatizada' },
        { status: 400 },
      );
    }
    if (!nombre) {
      return NextResponse.json({ error: 'nombre_completo requerido' }, { status: 400 });
    }
    if (!rolBuscado) {
      return NextResponse.json({ error: 'rol_buscado requerido (rol o puesto al que aplica)' }, { status: 400 });
    }
    if (!inicioIso) {
      return NextResponse.json({ error: 'examen_inicio_at requerido' }, { status: 400 });
    }

    const inicio = new Date(inicioIso).getTime();
    if (Number.isNaN(inicio)) {
      return NextResponse.json({ error: 'examen_inicio_at inválido' }, { status: 400 });
    }

    const examen = generarExamenAdaptativo(rol);
    const preguntasPers = personalidadDelExamen(examen);
    const preguntasLog = logicaDelExamen(examen);

    if (Object.keys(rp).length < preguntasPers.length) {
      return NextResponse.json({ error: 'Completa las 20 preguntas de personalidad' }, { status: 400 });
    }
    if (Object.keys(rl).length < preguntasLog.length) {
      return NextResponse.json({ error: 'Completa las 5 preguntas de lógica' }, { status: 400 });
    }

    const elapsed = Date.now() - inicio;
    const completoEnTiempo = elapsed <= QUINCE_MIN_MS + GRACIA_MS;

    let pp = 0;
    let pl = 0;
    let gma0a5 = 0;
    let total = 0;
    let nivelInt = 0;
    const colorDisc = body.color_disc != null ? String(body.color_disc).trim() || null : null;

    let semaforo = 'rojo';
    let estado = 'reprobado';
    let motivo = '';
    let status_tripode = 'rechazado';

    pp = puntajePersonalidad(rp, rol);
    const { puntaje: pl_val, gma0a5: gma } = puntajeLogica(rol as RolExamen, rl);
    pl = pl_val;
    gma0a5 = gma;
    total = puntajeTotal(pp, pl);
    nivelInt = nivelIntegridadRiesgo(rp, rol);
    const tripodeObj = calcularSemaforoTalento({
      puntajeLogica: gma0a5,
      nivelIntegridad: nivelInt,
      completoEnTiempo,
      colorDISC: colorDisc,
    });
    semaforo = semaforoDbFromTripode(tripodeObj) ?? 'amarillo';
    estado = estadoContratacionFromTripode(tripodeObj);
    motivo = tripodeObj.motivo;
    status_tripode = tripodeObj.status;

    const tripode = { motivo, status: status_tripode };

    const updateRow = {
      nombre_completo: nombre,
      nombres: nombresLegadoDesdeTextoLibre(nombre),
      cargo: rolBuscado ?? 'Por definir',
      email: body.email?.trim() || null,
      documento: body.documento?.trim() || null,
      telefono: body.telefono?.trim() || null,
      rol_buscado: rolBuscado,
      rol_examen: rol,
      respuestas_personalidad: rp,
      respuestas_logica: rl,
      puntaje_personalidad: Math.round(pp * 100) / 100,
      puntaje_logica: Math.round(pl * 100) / 100,
      puntaje_total: Math.round(total * 100) / 100,
      gma_0_5: gma0a5,
      nivel_integridad_riesgo: nivelInt,
      completo_en_tiempo: completoEnTiempo,
      motivo_semaforo: tripode.motivo,
      color_disc: colorDisc,
      status_evaluacion: tripode.status,
      semaforo,
      estado,
      examen_inicio_at: new Date(inicio).toISOString(),
      examen_completado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: rowRaw, error } = await supabase
      .from('ci_empleados')
      .update(updateRow as never)
      .eq('id', empleadoId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[talento examen evaluar]', error);
      return NextResponse.json(
        { error: error.message, hint: HINT_CI_EMPLEADOS },
        { status: 500 },
      );
    }

    const data = rowRaw as { id: string } | null;
    if (!data) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (tripode.status === 'rechazado') {
      await notifyTalentoWhatsAppExpiracion({
        empleadoId: data.id,
        nombre,
        telefono: body.telefono?.trim() || null,
        motivo: tripode.motivo,
      });
    }

    return NextResponse.json({
      id: data.id,
      status_evaluacion: tripode.status,
      motivo: tripode.motivo,
      semaforo,
      estado,
      gma_0_5: gma0a5,
      nivel_integridad_riesgo: nivelInt,
      completo_en_tiempo: completoEnTiempo,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
