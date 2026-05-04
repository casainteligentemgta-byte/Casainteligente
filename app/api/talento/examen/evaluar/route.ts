import { NextResponse } from 'next/server';
import {
  generarExamenAdaptativo,
  nivelIntegridadRiesgo,
  puntajeLogica,
  puntajePersonalidad,
  puntajeTotal,
} from '@/lib/talento/exam';
import {
  calcularSemaforoTalento,
  estadoContratacionFromTripode,
  semaforoDbFromTripode,
} from '@/lib/talento/semaphore';
import { nombresLegadoDesdeTextoLibre } from '@/lib/registro/ciEmpleadosNombresLegado';
import { supabaseForRoute } from '@/lib/talento/supabase-route';
import { notifyTalentoWhatsAppExpiracion } from '@/lib/talento/whatsapp';
import type { RolExamen } from '@/types/talento';

const QUINCE_MIN_MS = 15 * 60 * 1000;
const GRACIA_MS = 90 * 1000;

const HINT_CI_EMPLEADOS =
  'Ejecuta en Supabase (SQL Editor) supabase/manual_ci_empleados_solo.sql o las migraciones 025–028. Luego Project Settings → API → Reload schema.';

/**
 * POST: recibe el JSON del examen, calcula el trípode y actualiza `ci_empleados`.
 * Si `status_evaluacion` es `rechazado` (tiempo), dispara webhook WhatsApp.
 */
export async function POST(req: Request) {
  try {
    const sb = supabaseForRoute();
    if (!sb.ok) return sb.response;
    const supabase = sb.client;

    const body = (await req.json()) as {
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

    const empleadoId = (body.empleado_id ?? '').trim();
    const nombre = (body.nombre_completo ?? '').trim();
    const rol = body.rol_examen;
    const rolBuscado = (body.rol_buscado ?? '').trim() || null;
    const inicioIso = body.examen_inicio_at;
    const rp = body.respuestas_personalidad ?? {};
    const rl = body.respuestas_logica ?? {};

    if (!empleadoId) {
      return NextResponse.json({ error: 'empleado_id requerido' }, { status: 400 });
    }
    if (!nombre || (rol !== 'programador' && rol !== 'tecnico')) {
      return NextResponse.json({ error: 'nombre_completo y rol_examen válidos requeridos' }, { status: 400 });
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
    if (Object.keys(rp).length < examen.personalidad.length) {
      return NextResponse.json({ error: 'Completa las 20 preguntas de personalidad' }, { status: 400 });
    }
    if (Object.keys(rl).length < examen.logica.length) {
      return NextResponse.json({ error: 'Completa las 5 preguntas de lógica' }, { status: 400 });
    }

    const elapsed = Date.now() - inicio;
    const completoEnTiempo = elapsed <= QUINCE_MIN_MS + GRACIA_MS;

    const pp = puntajePersonalidad(rp);
    const { puntaje: pl, gma0a5 } = puntajeLogica(rol, rl);
    const total = puntajeTotal(pp, pl);
    const nivelInt = nivelIntegridadRiesgo(rp);
    const colorDisc = body.color_disc != null ? String(body.color_disc).trim() || null : null;

    const tripode = calcularSemaforoTalento({
      puntajeLogica: gma0a5,
      nivelIntegridad: nivelInt,
      completoEnTiempo,
      colorDISC: colorDisc,
    });

    const semaforo = semaforoDbFromTripode(tripode);
    const estado = estadoContratacionFromTripode(tripode);

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
