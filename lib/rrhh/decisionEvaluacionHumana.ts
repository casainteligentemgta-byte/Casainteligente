/**
 * OK humano post-test: el semáforo/máquina recomienda; RRHH decide aptitud.
 * Sin migración: reutiliza `estado`, `status_evaluacion`, `semaforo`, `observaciones_rrhh`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarAptitud } from '@/lib/rrhh/empleadoEstados';

export type DecisionEvaluacionHumana = 'aprobado' | 'rechazado';

export type EmpleadoDecisionInput = {
  estado?: string | null;
  examen_completado_at?: string | null;
  semaforo?: string | null;
  status_evaluacion?: string | null;
  puntaje_total?: number | null;
};

/** Tras el test, la aptitud queda pendiente de OK humano. */
export const ESTADO_TRAS_EXAMEN = 'evaluacion_pendiente' as const;

export function pendienteDecisionHumana(row: EmpleadoDecisionInput): boolean {
  const aptitud = normalizarAptitud(row.estado);
  if (
    aptitud === 'aprobado' ||
    aptitud === 'rechazado' ||
    aptitud === 'aprobado_con_observaciones'
  ) {
    return false;
  }
  const tieneResultadoMaquina = Boolean(
    (row.examen_completado_at ?? '').trim() ||
      (row.semaforo ?? '').trim() ||
      (row.status_evaluacion ?? '').trim() ||
      (row.puntaje_total != null && Number.isFinite(Number(row.puntaje_total))),
  );
  return aptitud === 'evaluacion_pendiente' && tieneResultadoMaquina;
}

export function etiquetaRecomendacionMaquina(row: {
  semaforo?: string | null;
  status_evaluacion?: string | null;
  motivo_semaforo?: string | null;
}): { semaforo: string; status: string; motivo: string; texto: string } {
  const semaforo = (row.semaforo ?? '').trim() || '—';
  const status = (row.status_evaluacion ?? '').trim() || '—';
  const motivo = (row.motivo_semaforo ?? '').trim() || 'Sin motivo registrado';
  const s = semaforo.toLowerCase();
  let recomendacion = 'Revisar con criterio de obra';
  if (s === 'verde' || status === 'aprobado') recomendacion = 'Recomendado aprobar';
  else if (s === 'amarillo' || status === 'aprobado_con_observaciones') {
    recomendacion = 'Aprobar con observaciones';
  } else if (s === 'rojo' || status === 'reprobado' || status === 'rechazado') {
    recomendacion = 'Recomendado rechazar';
  }
  return {
    semaforo,
    status,
    motivo,
    texto: `${recomendacion} (máquina: semáforo ${semaforo}, ${status})`,
  };
}

export type AplicarDecisionResult =
  | { ok: true; estado: DecisionEvaluacionHumana }
  | { ok: false; error: string; status: number };

/**
 * Persiste la decisión humana (Aprobar / Rechazar) sobre un expediente evaluado.
 */
export async function aplicarDecisionEvaluacionHumana(
  supabase: SupabaseClient,
  empleadoId: string,
  decision: DecisionEvaluacionHumana,
  notas?: string | null,
): Promise<AplicarDecisionResult> {
  const id = empleadoId.trim();
  if (!id) return { ok: false, error: 'empleadoId requerido', status: 400 };
  if (decision !== 'aprobado' && decision !== 'rechazado') {
    return { ok: false, error: 'Decisión inválida', status: 400 };
  }

  const { data: emp, error: selErr } = await supabase
    .from('ci_empleados')
    .select(
      'id,estado,examen_completado_at,semaforo,status_evaluacion,puntaje_total,observaciones_rrhh,estatus',
    )
    .eq('id', id)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message, status: 500 };
  if (!emp) return { ok: false, error: 'Expediente no encontrado', status: 404 };

  const row = emp as EmpleadoDecisionInput & {
    observaciones_rrhh?: string | null;
    estatus?: string | null;
  };

  if (!pendienteDecisionHumana(row)) {
    return {
      ok: false,
      error: 'Este expediente no está pendiente de OK humano (ya tiene decisión o falta el test).',
      status: 409,
    };
  }

  const ahora = new Date().toISOString();
  const notaTrim = (notas ?? '').trim();
  const prevObs = (row.observaciones_rrhh ?? '').trim();
  const marca =
    decision === 'aprobado'
      ? `[OK RRHH ${ahora.slice(0, 10)}] Aprobado para contrato/banca.`
      : `[OK RRHH ${ahora.slice(0, 10)}] Rechazado tras evaluación.`;
  const obsParts = [prevObs, marca, notaTrim].filter(Boolean);

  const patch: Record<string, unknown> = {
    estado: decision,
    updated_at: ahora,
    observaciones_rrhh: obsParts.join(' ').trim() || null,
  };

  // Al aprobar, si no tiene disponibilidad, entra a banca.
  if (decision === 'aprobado') {
    const est = (row.estatus ?? '').trim().toLowerCase();
    if (!est || est === 'pendiente') {
      patch.estatus = 'disponible';
    }
  }

  const { error: upErr } = await supabase
    .from('ci_empleados')
    .update(patch as never)
    .eq('id', id);

  if (upErr) return { ok: false, error: upErr.message, status: 500 };
  return { ok: true, estado: decision };
}
