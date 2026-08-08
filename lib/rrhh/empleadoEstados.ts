/**
 * Estados canónicos de `ci_empleados` (lectura / etiquetas).
 * No elimina columnas legacy: normaliza para UI y filtros.
 */

export type DisponibilidadEmpleado =
  | 'disponible'
  | 'asignado'
  | 'no_disponible'
  | 'vetado'
  | 'pendiente'
  | 'desconocido';

export type AptitudEmpleado =
  | 'aprobado'
  | 'rechazado'
  | 'evaluacion_pendiente'
  | 'aprobado_con_observaciones'
  | 'otro';

export type EmpleadoEstadosCanon = {
  aptitud: AptitudEmpleado;
  disponibilidad: DisponibilidadEmpleado;
  proceso: string;
  evaluacion: string;
  semaforo: string;
  /** Texto corto para listados (archivo / trabajadores). */
  etiqueta: string;
};

function norm(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

export function normalizarDisponibilidad(estatus: string | null | undefined): DisponibilidadEmpleado {
  const es = norm(estatus);
  if (es === 'disponible' || es === '') return 'disponible';
  if (es === 'asignado') return 'asignado';
  if (es === 'vetado') return 'vetado';
  if (es === 'pendiente') return 'pendiente';
  if (es === 'no_disponible' || es === 'no disponible') return 'no_disponible';
  return es ? 'desconocido' : 'disponible';
}

export function normalizarAptitud(estado: string | null | undefined): AptitudEmpleado {
  const e = norm(estado);
  if (e === 'aprobado') return 'aprobado';
  if (e === 'rechazado') return 'rechazado';
  if (e === 'evaluacion_pendiente' || e === 'evaluación_pendiente') return 'evaluacion_pendiente';
  if (e === 'aprobado_con_observaciones') return 'aprobado_con_observaciones';
  return e ? 'otro' : 'otro';
}

export type EmpleadoEstadosInput = {
  estado?: string | null;
  estatus?: string | null;
  /** Legacy (nómina / vistas antiguas). */
  status?: string | null;
  estado_proceso?: string | null;
  status_evaluacion?: string | null;
  semaforo?: string | null;
  semaforo_riesgo?: string | null;
};

/**
 * Lee y normaliza el conjunto de estados de un empleado.
 * Preferencia: `estatus` > `status` para disponibilidad.
 */
export function leerEmpleadoEstados(row: EmpleadoEstadosInput): EmpleadoEstadosCanon {
  const aptitud = normalizarAptitud(row.estado);
  const disponibilidad = normalizarDisponibilidad(row.estatus ?? row.status);
  const proceso = (row.estado_proceso ?? '').trim();
  const evaluacion = (row.status_evaluacion ?? '').trim();
  const semaforo = ((row.semaforo ?? row.semaforo_riesgo ?? '') as string).trim();

  let etiqueta = 'En proceso';
  if (aptitud === 'aprobado') etiqueta = 'Aprobado';
  else if (
    aptitud === 'rechazado' ||
    norm(evaluacion) === 'rojo' ||
    norm(evaluacion) === 'rechazado'
  ) {
    etiqueta = 'No aprobado';
  } else if (proceso === 'cv_completado') {
    etiqueta = 'CV cargado';
  } else if ((row.estatus ?? '').trim()) {
    etiqueta = (row.estatus ?? '').trim();
  } else if (proceso || (row.estado ?? '').trim()) {
    etiqueta = proceso || (row.estado ?? '').trim();
  }

  return { aptitud, disponibilidad, proceso, evaluacion, semaforo, etiqueta };
}

/** Apto para aparecer en selector de asignación (misma semántica que `esObreroDisponible`). */
export function esAptoParaAsignar(row: EmpleadoEstadosInput & { rol_examen?: string | null }): boolean {
  if ((row.rol_examen ?? '').trim().toLowerCase() !== 'obrero') return false;
  const s = leerEmpleadoEstados(row);
  if (s.aptitud !== 'aprobado') return false;
  return s.disponibilidad === 'disponible';
}

export function etiquetaEstadoEmpleado(row: EmpleadoEstadosInput): string {
  return leerEmpleadoEstados(row).etiqueta;
}
