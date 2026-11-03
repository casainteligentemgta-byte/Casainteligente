/** Centro de costo por obra (RPC `ci_costo_obra`). Todo en USD. */

export const REGLA_MANO_OBRA_COSTO =
  'Nómina pagada si existe para el empleado y la semana; si no, jornales. Nunca ambos para el mismo empleado y periodo.';

export const MIGRACION_COSTO_OBRA = '395_ci_costo_obra.sql';

export type CostoObraFuenteManoObra = 'nomina' | 'jornales' | 'mixto' | 'ninguna';

export type CostoObraDetalleItem = {
  tipo: string;
  id?: string | number | null;
  label: string;
  usd: number;
  empleado_id?: string | null;
  fecha?: string | null;
  desde?: string | null;
  hasta?: string | null;
  dias?: number | null;
  costo_diario?: number | null;
};

export type CostoObraPartidaMateriales = {
  usd: number;
  compras_usd: number;
  egresos_ajenos_usd: number;
  detalle: CostoObraDetalleItem[];
};

export type CostoObraPartidaManoObra = {
  usd: number;
  fuente: CostoObraFuenteManoObra;
  nomina_usd: number;
  jornales_usd: number;
  detalle: CostoObraDetalleItem[];
};

export type CostoObraPartidaHerramientas = {
  usd: number;
  detalle: CostoObraDetalleItem[];
};

export type CostoObraPartidaOtros = {
  usd: number;
  gastos_obra_usd: number;
  registros_gastos_usd: number;
  detalle: CostoObraDetalleItem[];
};

export type CostoObraHonorariosAd = {
  pct: number;
  usd: number;
  fuente: string;
};

export type CostoObraPayload = {
  proyecto_id: string;
  proyecto_nombre: string;
  excluido_demo: boolean;
  regla_mano_obra: string;
  tasa_bcv_ves_por_usd: number;
  partidas: {
    materiales: CostoObraPartidaMateriales;
    mano_obra: CostoObraPartidaManoObra;
    herramientas: CostoObraPartidaHerramientas;
    otros: CostoObraPartidaOtros;
  };
  honorarios_ad: CostoObraHonorariosAd;
  total_directo_usd: number;
  total_con_honorarios_ad_usd: number;
};

export type NominaPagadaFila = {
  empleado_id: string;
  semana_inicio: string;
  semana_fin: string;
  total_usd: number;
};

export type JornalFila = {
  empleado_id: string;
  fecha: string;
  costo_jornal: number;
};

export type EgresoAlmacenCosto = {
  origen_proyecto_id: string | null;
  cantidad: number;
  average_weighted_cost: number | null;
  last_purchase_price: number | null;
};
