/** Resultado del semáforo ABC (evaluación obrero / vigilante). */
export type ResultadoSemaforoObrero = {
  semaforo: 'verde' | 'amarillo' | 'rojo';
  estado: 'aprobado' | 'aprobado_con_observaciones' | 'reprobado';
  motivo: string;
  status_evaluacion: 'aprobado' | 'aprobado_con_observaciones' | 'reprobado';
  puntaje_personalidad: number;
  puntaje_total: number;
  resumen: { respuestasA: number; respuestasB: number; respuestasC: number };
};

export const ROLES_EVALUACION_EXAMEN = [
  'obrero',
  'vigilante',
  'tecnico',
  'empleado',
  'programador',
] as const;

export type RolEvaluacionExamen = (typeof ROLES_EVALUACION_EXAMEN)[number];

export function esRolEvaluacionExamen(rol: string): rol is RolEvaluacionExamen {
  return (ROLES_EVALUACION_EXAMEN as readonly string[]).includes(rol);
}

/**
 * Cuenta respuestas A/B/C y aplica reglas de semáforo.
 * Escala umbrales al tamaño del banco (20 completo o 9 en evaluación unificada).
 * `respuestas` es un objeto: { obr_01: "A", obr_02: "B", ... }
 */
export function evaluarSemaforoObrero(
  respuestas: Record<string, string | number>,
): ResultadoSemaforoObrero {
  let respuestasA = 0;
  let respuestasB = 0;
  let respuestasC = 0;

  Object.values(respuestas).forEach((valor) => {
    const v = String(valor).toUpperCase();
    if (v === 'A') respuestasA++;
    if (v === 'B') respuestasB++;
    if (v === 'C') respuestasC++;
  });

  const resumen = { respuestasA, respuestasB, respuestasC };
  const nRespuestas = Object.keys(respuestas).length;
  const totalPreguntas = nRespuestas > 0 ? nRespuestas : 20;
  /** Referencia 20 ítems: rojo ≥3 C; verde ≥14 A y 0 C. */
  const umbralRojoC = Math.max(2, Math.ceil((3 / 20) * totalPreguntas));
  const umbralVerdeA = Math.ceil((14 / 20) * totalPreguntas);
  const pp = (respuestasA / totalPreguntas) * 100;
  const puntaje = Math.round(pp * 100) / 100;

  if (respuestasC >= umbralRojoC) {
    return {
      semaforo: 'rojo',
      estado: 'reprobado',
      motivo: `Conductas de riesgo detectadas (${umbralRojoC} o más respuestas C)`,
      status_evaluacion: 'reprobado',
      puntaje_personalidad: puntaje,
      puntaje_total: puntaje,
      resumen,
    };
  }
  if (respuestasA >= umbralVerdeA && respuestasC === 0) {
    return {
      semaforo: 'verde',
      estado: 'aprobado',
      motivo: 'Perfil seguro e ideal',
      status_evaluacion: 'aprobado',
      puntaje_personalidad: puntaje,
      puntaje_total: puntaje,
      resumen,
    };
  }
  return {
    semaforo: 'amarillo',
    estado: 'aprobado_con_observaciones',
    motivo: 'Perfil pasivo o con observaciones menores',
    status_evaluacion: 'aprobado_con_observaciones',
    puntaje_personalidad: puntaje,
    puntaje_total: puntaje,
    resumen,
  };
}
