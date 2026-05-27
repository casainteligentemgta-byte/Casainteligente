export type IngenieroResidente = {
  id: string;
  nombre: string;
  cargo: string | null;
  cedula: string | null;
  celular: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
};

/** @deprecated Usar IngenieroResidente desde RRHH */
export type PerfilCampo = IngenieroResidente;

export type EquipoAlertasPayload = {
  proyectoId: string;
  proyectoNombre: string;
  ingenieroAsignado: IngenieroResidente | null;
  empleadosDisponibles: IngenieroResidente[];
  botUsername: string | null;
  /** Origen de la asignación: personal de RRHH */
  fuente: 'rrhh';
};

export type AvanceDiarioCampo = {
  id: string;
  proyecto_id: string;
  partida_id: string;
  perfil_id: string | null;
  empleado_id?: string | null;
  fecha_reporte: string;
  cantidad_ejecutada_hoy: number;
  rendimiento_teorico: number;
  eficiencia_calculada: number;
  rentabilidad_diaria: number;
  unidad: string;
  notas: string | null;
  created_at: string;
};
