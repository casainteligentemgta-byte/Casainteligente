export type RolExamen = 'programador' | 'tecnico';

export type SemaforoTalento = 'verde' | 'amarillo' | 'rojo';

export type EstadoEmpleadoTalento = 'evaluacion_pendiente' | 'aprobado' | 'rechazado';

export interface PreguntaPersonalidad {
  id: string;
  bloque: string;
  texto: string;
}

/** Ítem situacional (4 opciones) para examen obrero / técnico obra. */
export interface PreguntaSituacionalObra {
  id: string;
  bloque: string;
  texto: string;
  opciones: [string, string, string, string];
  mejor: 0 | 1 | 2 | 3;
  riesgo: 0 | 1 | 2 | 3;
}

export type ItemPersonalidadExamen = PreguntaPersonalidad | PreguntaSituacionalObra;

export interface PreguntaLogica {
  id: string;
  texto: string;
  opciones: string[];
  correcta: number;
}

export interface ExamenGenerado {
  rol: RolExamen;
  personalidad: ItemPersonalidadExamen[];
  logica: PreguntaLogica[];
}

/** Pregunta tipo test para UI móvil paso a paso (`ExamenMovil`). */
export interface PreguntaExamenMovilOpcion {
  texto: string;
}

export interface PreguntaExamenMovil {
  id: string;
  pregunta: string;
  opciones: PreguntaExamenMovilOpcion[];
}
