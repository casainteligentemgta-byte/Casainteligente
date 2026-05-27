export type IngenieroResidente = {
  id: string;
  nombre: string;
  nombres: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  cargo: string | null;
  cedula: string | null;
  celular: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
};

export type IngenieroResidenteManualInput = {
  nombres: string;
  primerApellido: string;
  segundoApellido?: string;
  cedula: string;
};

/** @deprecated Usar IngenieroResidente desde RRHH */
export type PerfilCampo = IngenieroResidente;

export type EquipoAlertasPayload = {
  proyectoId: string;
  proyectoNombre: string;
  ingenieroAsignado: IngenieroResidente | null;
  botUsername: string | null;
  /** Datos capturados manualmente en el módulo del proyecto */
  fuente: 'manual';
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
