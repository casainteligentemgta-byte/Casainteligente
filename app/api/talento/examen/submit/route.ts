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
import { supabaseForRoute } from '@/lib/talento/supabase-route';
import type { RolExamen } from '@/types/talento';

const QUINCE_MIN_MS = 15 * 60 * 1000;
const GRACIA_MS = 90 * 1000;

const HINT_CI_EMPLEADOS =
  'Ejecuta en Supabase (SQL Editor) supabase/manual_ci_empleados_solo.sql o las migraciones 025–028. Luego Project Settings → API → Reload schema.';

export async function POST(req: Request) {
  try {
    const sb = supabaseForRoute();
    if (!sb.ok) return sb.response;
    const supabase = sb.client;
    const body = (await req.json()) as {
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

    const nombre = (body.nombre_completo ?? '').trim();
    const rol = body.rol_examen;
    const rolBuscado = (body.rol_buscado ?? '').trim() || null;
    const inicioIso = body.examen_inicio_at;
    const rp = body.respuestas_personalidad ?? {};
    const rl = body.respuestas_logica ?? {};

    if (!nombre || (rol !== 'programador' && rol !== 'tecnico')) {
      return NextResponse.json({ error: 'nombre y rol_examen válidos requeridos' }, { status: 400 });
    }

    if (!inicioIso) {
      return NextResponse.json({ error: 'examen_inicio_at requerido' }, { status: 400 });
    }

    const inicio = new Date(inicioIso).getTime();
    if (Number.isNaN(inicio)) {
      return NextResponse.json({ error: 'examen_inicio_at inválido' }, { status: 400 });
    }

    const elapsed = Date.now() - inicio;
    const completoEnTiempo = elapsed <= QUINCE_MIN_MS + GRACIA_MS;
    if (!completoEnTiempo) {
      return NextResponse.json(
        { error: 'tiempo_excedido', hint: 'El examen tiene un máximo de 15 minutos.' },
        { status: 403 },
      );
    }

    const examen = generarExamenAdaptativo(rol);
    if (Object.keys(rp).length < examen.personalidad.length) {
      return NextResponse.json({ error: 'Completa las 20 preguntas de personalidad' }, { status: 400 });
    }
    if (Object.keys(rl).length < examen.logica.length) {
      return NextResponse.json({ error: 'Completa las 5 preguntas de lógica' }, { status: 400 });
    }

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
    const semaforo = semaforoDbFromTripode(tripode) ?? 'amarillo';
    const estado = estadoContratacionFromTripode(tripode);

    const insertRow = {
      nombre_completo: nombre,
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
    };

    const { data: rowRaw, error } = await supabase
      .from('ci_empleados')
      // Tipos generated de Supabase no incluyen ci_* aún
      .insert(insertRow as never)
      .select('id')
      .single();

    if (error) {
      console.error('[talento examen]', error);
      return NextResponse.json(
        { error: error.message, hint: HINT_CI_EMPLEADOS },
        { status: 500 },
      );
    }

    const data = rowRaw as { id: string } | null;
    if (!data) {
      return NextResponse.json({ error: 'No se pudo guardar el examen' }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      puntaje_personalidad: pp,
      puntaje_logica: pl,
      puntaje_total: total,
      gma_0_5: gma0a5,
      nivel_integridad_riesgo: nivelInt,
      completo_en_tiempo: completoEnTiempo,
      semaforo,
      estado,
      motivo: tripode.motivo,
      status_tripode: tripode.status,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
