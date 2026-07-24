import { calcularRiesgoObrero } from '@/lib/talento/calcularRiesgoObrero';

/**
 * Valor para persistir en `ci_empleados.semaforo_riesgo` tras evaluación obrero.
 */
export function semaforoRiesgoDbDesdeEvaluacion(campos: {
  perfil_color?: string | null;
  puntuacion_logica?: number | null;
  tiempo_respuesta?: number | null;
}): 'verde' | 'amarillo' | 'rojo' | null {
  const { nivel } = calcularRiesgoObrero(campos);
  if (nivel === 'sin_datos') return null;
  return nivel;
}

export function motivoSemaforoRiesgoDesdeEvaluacion(campos: {
  perfil_color?: string | null;
  puntuacion_logica?: number | null;
  tiempo_respuesta?: number | null;
}): string {
  return calcularRiesgoObrero(campos).tooltip;
}
