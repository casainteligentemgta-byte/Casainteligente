/** Fila de `cronograma_tareas` (+ datos opcionales de partida para el panel lateral). */
export type CronogramaTarea = {
  id: string;
  proyecto_id: string;
  partida_id: string | null;
  codigo_partida: string | null;
  nombre_tarea: string;
  fecha_inicio_planificada: string;
  fecha_fin_planificada: string;
  porcentaje_avance: number;
  orden?: number;
  notas?: string | null;
  /** `capitulo` = fila resumen; `partida` = actividad ejecutable. */
  tipo?: 'capitulo' | 'partida';
  capitulo_id?: string | null;
  capitulo_codigo?: string | null;
  capitulo_nombre?: string | null;
  descripcion_partida?: string | null;
  unidad_partida?: string | null;
  cantidad_presupuestada?: number | null;
  evidencias_fotos?: string[];
  evidencias_videos?: string[];
};

/** Capítulo del presupuesto con partidas para vista en cascada en el Gantt. */
export type CronogramaCapitulo = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  partidas: CronogramaTarea[];
};

export type CronogramaEscala = 'semana' | 'mes';

export type CronogramaBarraEstado = 'a_tiempo' | 'en_riesgo' | 'atrasada' | 'completada';
