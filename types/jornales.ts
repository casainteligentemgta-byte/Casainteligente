/** Control de jornales de obra: asistencia semanal y costo de mano de obra (USD). */

export const DIAS_SEMANA_VE = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
export type DiaSemanaVe = (typeof DIAS_SEMANA_VE)[number];

export type JornalAsistenciaDia = {
  fecha: string;
  presente: boolean;
  costo_jornal: number | null;
};

export type JornalColaboradorFila = {
  empleado_id: string;
  nombre_completo: string;
  cargo_nombre: string | null;
  jornal_diario_usd: number;
  asistencias: JornalAsistenciaDia[];
  dias_asistidos: number;
  costo_semanal_usd: number;
};

export type JornalesKpis = {
  trabajadores_activos: number;
  costo_mano_obra_acumulado_usd: number;
  costo_semana_usd: number;
  promedio_por_jornal_usd: number;
};

export type JornalesSemanaPayload = {
  proyecto_id: string;
  proyecto_nombre: string;
  semana_inicio: string;
  semana_fin: string;
  dias: string[];
  colaboradores: JornalColaboradorFila[];
  kpis: JornalesKpis;
};

export type JornalesPostToggle = {
  accion: 'toggle';
  empleado_id: string;
  fecha: string;
  presente: boolean;
  costo_jornal?: number;
};

export type JornalesPostMarcarHoy = {
  accion: 'marcar_hoy';
  costo_jornal?: number;
};

export type JornalesPostTarifa = {
  accion: 'tarifa';
  empleado_id: string;
  costo_jornal_usd: number;
  aplicar_semana?: boolean;
  semana_inicio?: string;
};

export type JornalesPostBody = JornalesPostToggle | JornalesPostMarcarHoy | JornalesPostTarifa;
