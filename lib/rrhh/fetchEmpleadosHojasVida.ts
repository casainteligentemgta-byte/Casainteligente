import type { SupabaseClient } from '@supabase/supabase-js';

export type EmpleadoHojaVidaRow = {
  id: string;
  nombre_completo: string | null;
  documento: string | null;
  cedula: string | null;
  celular: string | null;
  telefono: string | null;
  created_at: string;
  estado_proceso: string | null;
  estado: string | null;
  estatus: string | null;
  cargo_nombre: string | null;
  recruitment_need_id: string | null;
  proyecto_modulo_id: string | null;
  observaciones_rrhh: string | null;
  status_evaluacion: string | null;
  semaforo: string | null;
  semaforo_riesgo: string | null;
  perfil_color: string | null;
  motivo_semaforo: string | null;
  motivo_semaforo_riesgo: string | null;
  puntaje_total: number | null;
  puntaje_logica: number | null;
  puntaje_personalidad: number | null;
  puntuacion_logica: number | null;
  puntuacion_confiabilidad: number | null;
  nivel_integridad_riesgo: string | null;
  tiempo_respuesta: number | null;
  examen_completado_at: string | null;
};

const COLS_MINIMAS =
  'id,nombre_completo,documento,cedula,celular,telefono,created_at,estado_proceso,estado,estatus,cargo_nombre,recruitment_need_id,proyecto_modulo_id';
const COLS_EXTENDIDAS =
  'status_evaluacion,semaforo,semaforo_riesgo,perfil_color,motivo_semaforo,motivo_semaforo_riesgo,puntaje_total,puntaje_logica,puntaje_personalidad,puntuacion_logica,puntuacion_confiabilidad,nivel_integridad_riesgo,tiempo_respuesta,examen_completado_at,observaciones_rrhh';

function mapRow(r: EmpleadoHojaVidaRow): EmpleadoHojaVidaRow {
  return {
    ...r,
    estatus: r.estatus ?? null,
    estado: r.estado ?? null,
    status_evaluacion: r.status_evaluacion ?? null,
    semaforo: r.semaforo ?? null,
    semaforo_riesgo: r.semaforo_riesgo ?? null,
    perfil_color: r.perfil_color ?? null,
    motivo_semaforo: r.motivo_semaforo ?? null,
    motivo_semaforo_riesgo: r.motivo_semaforo_riesgo ?? null,
    puntaje_total: r.puntaje_total ?? null,
    puntaje_logica: r.puntaje_logica ?? null,
    puntaje_personalidad: r.puntaje_personalidad ?? null,
    puntuacion_logica: r.puntuacion_logica ?? null,
    puntuacion_confiabilidad: r.puntuacion_confiabilidad ?? null,
    nivel_integridad_riesgo: r.nivel_integridad_riesgo ?? null,
    tiempo_respuesta: r.tiempo_respuesta ?? null,
    examen_completado_at: r.examen_completado_at ?? null,
    observaciones_rrhh: r.observaciones_rrhh ?? null,
  };
}

/** Expediente con hoja de vida cargada (jsonb o proceso completado). */
export function empleadoTieneHojaVidaCargada(row: {
  hoja_vida_obrero?: unknown;
  estado_proceso?: string | null;
}): boolean {
  const ep = (row.estado_proceso ?? '').trim();
  if (ep === 'cv_completado') return true;
  const raw = row.hoja_vida_obrero;
  if (raw == null) return false;
  if (typeof raw === 'string') return raw.trim().length > 2;
  if (typeof raw === 'object') return Object.keys(raw as object).length > 0;
  return false;
}

export type ModoListaHojasVida = 'pipeline' | 'archivo';

export async function fetchEmpleadosHojasVida(
  supabase: SupabaseClient,
  modo: ModoListaHojasVida,
): Promise<{ data: EmpleadoHojaVidaRow[]; error: string | null }> {
  const withObsCols = `${COLS_MINIMAS},${COLS_EXTENDIDAS}`;
  const colsMinimas = COLS_MINIMAS;
  const limit = modo === 'archivo' ? 800 : 300;

  let query = supabase.from('ci_empleados').select(withObsCols).order('created_at', { ascending: false }).limit(limit);

  if (modo === 'pipeline') {
    query = query.eq('estado_proceso', 'cv_completado');
  } else {
    query = query.or('hoja_vida_obrero.not.is.null,estado_proceso.eq.cv_completado');
  }

  let result = (await query) as unknown as {
    data: EmpleadoHojaVidaRow[] | null;
    error: { message: string } | null;
  };

  if (result.error) {
    let fallback = supabase.from('ci_empleados').select(colsMinimas).order('created_at', { ascending: false }).limit(limit);
    if (modo === 'pipeline') {
      fallback = fallback.eq('estado_proceso', 'cv_completado');
    } else {
      fallback = fallback.or('hoja_vida_obrero.not.is.null,estado_proceso.eq.cv_completado');
    }
    result = (await fallback) as unknown as typeof result;
  }

  if (result.error) {
    return { data: [], error: result.error.message };
  }

  const rows = ((result.data ?? []) as EmpleadoHojaVidaRow[]).map(mapRow);
  return { data: rows, error: null };
}

export function etiquetaEstadoArchivo(r: EmpleadoHojaVidaRow): string {
  const est = (r.estado ?? '').trim();
  const ep = (r.estado_proceso ?? '').trim();
  const ev = (r.status_evaluacion ?? '').trim();
  const st = (r.estatus ?? '').trim();
  if (est === 'aprobado') return 'Aprobado';
  if (est === 'rechazado' || ev === 'rojo' || ev === 'rechazado') return 'No aprobado';
  if (ep === 'cv_completado') return 'CV cargado';
  if (st) return st;
  return ep || est || 'En proceso';
}
