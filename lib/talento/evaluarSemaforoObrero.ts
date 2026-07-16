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
  'programador',
  'tecnico',
  'obrero',
  'vigilante',
] as const;

export type RolEvaluacionExamen = (typeof ROLES_EVALUACION_EXAMEN)[number];

export function esRolEvaluacionExamen(rol: string): rol is RolEvaluacionExamen {
  return (ROLES_EVALUACION_EXAMEN as readonly string[]).includes(rol);
}

/**
 * Cuenta respuestas A/B/C y aplica reglas de semáforo (20 ítems).
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
  const totalPreguntas = Math.max(Object.keys(respuestas).length, 20);
  const pp = (respuestasA / totalPreguntas) * 100;
  const puntaje = Math.round(pp * 100) / 100;

  if (respuestasC >= 3) {
    return {
      semaforo: 'rojo',
      estado: 'reprobado',
      motivo: 'Conductas de riesgo detectadas (3 o más respuestas C)',
      status_evaluacion: 'reprobado',
      puntaje_personalidad: puntaje,
      puntaje_total: puntaje,
      resumen,
    };
  }
  if (respuestasA >= 14 && respuestasC === 0) {
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
