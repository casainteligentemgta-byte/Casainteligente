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
