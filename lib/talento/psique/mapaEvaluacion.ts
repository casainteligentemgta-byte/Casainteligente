import type { RolExamenPsique } from '@/lib/talento/psique/recomendarPruebasPsique';

/** Motor de scoring / semáforo del “libro” de evaluación Casa Inteligente. */
export type MotorSemaforoLibro = 'tripode' | 'abc_obrero';

export type MapaEvaluacionPsique = {
  rol_examen: RolExamenPsique;
  /** Etiqueta corta para UI. */
  banco: string;
  motor: MotorSemaforoLibro;
  /** Nombre del libro / metodología de scoring. */
  libro: string;
  /** Qué columnas alimenta el semáforo. */
  ejes: string[];
  /** Reglas resumidas (trípode o ABC). */
  reglas_semaforo: string[];
  duracion_minutos: number;
};

/**
 * Une la batería Psique con el banco de examen y el semáforo del libro de evaluación.
 * - Trípode (libro técnico/TI): GMA + integridad + tiempo → `calcularSemaforoTalento`
 * - ABC (libro obrero/vigilante): conteo A/B/C → `evaluarSemaforoObrero`
 */
export function mapaEvaluacionDesdeRol(rol: RolExamenPsique | null): MapaEvaluacionPsique {
  const r: RolExamenPsique = rol ?? 'tecnico';

  if (r === 'programador') {
    return {
      rol_examen: 'programador',
      banco: 'Personalidad (frecuencia) + lógica TI',
      motor: 'tripode',
      libro: 'Libro de evaluación — Trípode (GMA · Integridad · Tiempo)',
      ejes: ['gma_0_5', 'nivel_integridad_riesgo', 'completo_en_tiempo', 'semaforo'],
      reglas_semaforo: [
        'Fuera de 15 min → rechazado',
        'Integridad ≥ 8 o GMA ≤ 1 → rojo',
        'Integridad ≥ 5 o GMA < 4 → amarillo',
        'GMA ≥ 4 e integridad < 5 → verde',
      ],
      duracion_minutos: 15,
    };
  }

  if (r === 'obrero' || r === 'vigilante') {
    return {
      rol_examen: r,
      banco: r === 'vigilante' ? 'Situacional ABC (vigilancia)' : 'Situacional ABC (obra)',
      motor: 'abc_obrero',
      libro: 'Libro de evaluación — Semáforo ABC (obra / vigilancia)',
      ejes: ['semaforo', 'motivo_semaforo', 'puntaje_total'],
      reglas_semaforo: [
        '≥ 3 respuestas C → rojo',
        '≥ 14 respuestas A y 0 C → verde',
        'Resto → amarillo (revisión)',
      ],
      duracion_minutos: 15,
    };
  }

  // tecnico (UI: Obrero / técnico obra)
  return {
    rol_examen: 'tecnico',
    banco: 'Conducta situacional obra + lógica de campo',
    motor: 'tripode',
    libro: 'Libro de evaluación — Trípode (GMA · Integridad · Tiempo)',
    ejes: ['gma_0_5', 'nivel_integridad_riesgo', 'completo_en_tiempo', 'semaforo'],
    reglas_semaforo: [
      'Fuera de 15 min → rechazado',
      'Integridad ≥ 8 o GMA ≤ 1 → rojo',
      'Integridad ≥ 5 o GMA < 4 → amarillo',
      'GMA ≥ 4 e integridad < 5 → verde',
    ],
    duracion_minutos: 15,
  };
}

export function esRolExamenCompleto(v: string | null | undefined): v is RolExamenPsique {
  return v === 'programador' || v === 'tecnico' || v === 'obrero' || v === 'vigilante';
}
