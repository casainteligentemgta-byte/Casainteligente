export type RolExamen = 'programador' | 'tecnico';

export type SemaforoTalento = 'verde' | 'amarillo' | 'rojo';

export type EstadoEmpleadoTalento = 'evaluacion_pendiente' | 'aprobado' | 'rechazado';

export interface PreguntaPersonalidad {
  id: string;
  bloque: string;
  texto: string;
}

export interface PreguntaLogica {
  id: string;
  texto: string;
  opciones: string[];
  correcta: number;
}

export interface ExamenGenerado {
  rol: RolExamen;
  personalidad: PreguntaPersonalidad[];
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
