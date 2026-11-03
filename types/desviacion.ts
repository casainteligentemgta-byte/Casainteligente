/** Alerta de desviación presupuestaria de obra (todo en USD). */

export type SaludDesviacion = 'verde' | 'ambar' | 'rojo';

export type DesviacionCapitulo = {
  codigo: string;
  descripcion: string;
  presupuesto_usd: number;
  ejecutado_usd: number;
  diferencia_usd: number;
  desviacion_pct: number | null;
  pct_consumido: number | null;
};

export type DesviacionAlerta = {
  id: string;
  severidad: 'alerta' | 'advertencia' | 'ok';
  mensaje: string;
};

export type DesviacionDesglose = {
  mano_obra_usd: number;
  materiales_usd: number;
  egresos_almacen_usd: number;
};

export type DesviacionPresupuestariaPayload = {
  proyecto_id: string;
  proyecto_nombre: string;
  presupuesto_estimado_usd: number;
  fuente_presupuesto: string;
  gasto_ejecutado_usd: number;
  diferencia_usd: number;
  desviacion_pct: number | null;
  pct_consumido: number | null;
  salud: SaludDesviacion;
  desglose: DesviacionDesglose;
  capitulos: DesviacionCapitulo[];
  umbral_pct: number;
  umbral_materiales_pct: number;
  umbral_mano_obra_pct: number;
  limite_jornadas_instalacion: number | null;
  especialidad_limite: string | null;
  alertas: DesviacionAlerta[];
  tasa_bcv_ves_por_usd: number;
};
