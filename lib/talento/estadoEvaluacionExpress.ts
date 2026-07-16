/**
 * Estado inicial de evaluación al formalizar contrato express (obrero sin examen aún).
 * `pendiente_regularizar` dispara alertas en RRHH / reclutamiento.
 */
export const ESTADO_EVALUACION_EXPRESS_INICIAL = {
  rol_examen: 'obrero',
  respuestas_personalidad: {} as Record<string, never>,
  respuestas_logica: {} as Record<string, never>,
  semaforo: 'rojo',
  status_evaluacion: 'pendiente_regularizar',
} as const;

export function esStatusPendienteRegularizar(status: string | null | undefined): boolean {
  return (status ?? '').trim().toLowerCase() === ESTADO_EVALUACION_EXPRESS_INICIAL.status_evaluacion;
}
