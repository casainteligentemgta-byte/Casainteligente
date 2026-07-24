/** Tipos compartidos: API APU + panel analítico Lulo. */

export type InsumoMaestroLulo = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precio_base: number;
  tipo: string | null;
};

export type PartidaApuLulo = {
  id: string;
  codigo_partida: string;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada?: number;
  precio_unitario_estimado?: number;
  monto_total_estimado?: number;
};

export type LineaApuInsumoLulo = {
  id: string;
  partida_id: string;
  insumo_id: string;
  cantidad_rendimiento: number;
  desperdicio_porcentaje: number;
  insumo: InsumoMaestroLulo;
};

export type MargenesProyectoApu = {
  porcentaje_admin?: number | null;
  porcentaje_utilidad?: number | null;
  porcentaje_fcm?: number | null;
};
