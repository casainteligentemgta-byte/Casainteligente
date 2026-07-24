import type { SemaforoTalento } from '@/types/talento';

/**
 * Resultado del Trípode de Evaluación (puede ser rechazo por tiempo sin semáforo de color).
 */
export type StatusTripode = 'verde' | 'amarillo' | 'rojo' | 'rechazado';

export interface ResultadoTripode {
  status: StatusTripode;
  motivo: string;
}

export interface DatosExamenTripode {
  /** GMA: aciertos de lógica en escala 0–5 (5 preguntas). */
  puntajeLogica: number;
  /** Riesgo integridad 0–10 (mayor = peor; menor integridad percibida). */
  nivelIntegridad: number;
  /** Completó dentro del límite (15 min + gracia servidor). */
  completoEnTiempo: boolean;
  /** Opcional: perfil DISC / etiqueta para reporting (no afecta la lógica por defecto). */
  colorDISC?: string | null;
}

/**
 * Trípode de Evaluación:
 * 1. Lógica (GMA): 0–5 puntos
 * 2. Integridad (riesgo): 0–10 (menor es mejor; aquí mayor número = más riesgo)
 * 3. Tiempo: debe completar en < 15 min (validado también en API)
 */
export function calcularSemaforoTalento(datosExamen: DatosExamenTripode): ResultadoTripode {
  const { puntajeLogica, nivelIntegridad, completoEnTiempo } = datosExamen;

  if (!completoEnTiempo) {
    return { status: 'rechazado', motivo: 'Incumplimiento de tiempo (15 min)' };
  }

  if (nivelIntegridad >= 8 || puntajeLogica <= 1) {
    return {
      status: 'rojo',
      motivo:
        nivelIntegridad >= 8
          ? 'Riesgo ético alto (posible manipulador)'
          : 'Capacidad cognitiva insuficiente',
    };
  }

  if (nivelIntegridad >= 5 || puntajeLogica < 4) {
    return {
      status: 'amarillo',
      motivo: 'Requiere supervisión o entrevista de confrontación',
    };
  }

  if (puntajeLogica >= 4 && nivelIntegridad < 5) {
    return { status: 'verde', motivo: 'Candidato de alto rendimiento' };
  }

  return { status: 'amarillo', motivo: 'Revisión manual requerida' };
}

/** Mapea resultado del trípode a columna `semaforo` (nullable si rechazo solo por tiempo). */
export function semaforoDbFromTripode(r: ResultadoTripode): SemaforoTalento | null {
  if (r.status === 'rechazado') return null;
  if (r.status === 'verde' || r.status === 'amarillo' || r.status === 'rojo') return r.status;
  return null;
}

/** Estado contratación en BD. */
export function estadoContratacionFromTripode(r: ResultadoTripode): 'aprobado' | 'rechazado' {
  if (r.status === 'rechazado') return 'rechazado';
  if (r.status === 'rojo') return 'rechazado';
  return 'aprobado';
}
