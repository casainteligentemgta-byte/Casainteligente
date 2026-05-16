import type { EmpleadoHojaVidaRow } from '@/lib/rrhh/fetchEmpleadosHojasVida';

export type EstadoEvaluacionFila = 'evaluado' | 'pendiente' | 'en_curso';

export function empleadoTieneEvaluacionCompleta(row: {
  examen_completado_at?: string | null;
  puntaje_total?: number | null;
  status_evaluacion?: string | null;
  semaforo?: string | null;
}): boolean {
  if ((row.examen_completado_at ?? '').trim()) return true;
  if (row.puntaje_total != null && Number.isFinite(row.puntaje_total)) return true;
  const st = (row.status_evaluacion ?? '').trim().toLowerCase();
  if (st && st !== 'pendiente' && st !== 'amarillo') return true;
  const sem = (row.semaforo ?? '').trim().toLowerCase();
  return sem === 'verde' || sem === 'rojo';
}

export function estadoEvaluacionFila(row: EmpleadoHojaVidaRow): EstadoEvaluacionFila {
  if (empleadoTieneEvaluacionCompleta(row)) return 'evaluado';
  const st = (row.status_evaluacion ?? '').trim().toLowerCase();
  if (st === 'amarillo' || st === 'en_curso') return 'en_curso';
  return 'pendiente';
}

export function etiquetaEstadoEvaluacion(row: EmpleadoHojaVidaRow): string {
  const e = estadoEvaluacionFila(row);
  if (e === 'evaluado') {
    const sem = (row.semaforo ?? '').trim() || (row.status_evaluacion ?? '').trim();
    return sem ? `Evaluado · ${sem}` : 'Evaluado';
  }
  if (e === 'en_curso') return 'Evaluación en curso';
  return 'Sin evaluación';
}

export function normCedula(v: string): string {
  return v.replace(/\uFEFF/g, '').trim().replace(/^v/i, '').replace(/\s+/g, '').toLowerCase();
}

export type ExpressSinEvaluacion = {
  id: string;
  obrero_nombre: string;
  obrero_cedula: string;
  created_at: string;
  formalizado_empleado_id: string | null;
  /** Si existe expediente con la misma cédula. */
  empleado_id: string | null;
  empleado_tiene_evaluacion: boolean;
};
