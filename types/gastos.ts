/**
 * Tipos del libro histórico CCO (tabla Supabase `registros_gastos`).
 * Coincide con el CSV RANCHO / maestro V4.
 */

export type GastoRegistro = {
  id: number | string;
  clase: string | null;
  fecha: string | null;
  proveedor: string | null;
  tipo: string | null;
  capitulo: string | null;
  subcapitulo: string | null;
  descripcion: string | null;
  contrato_vinculado: string | null;
  moneda: string | null;
  tasa: number | null;
  monto_orig: number | null;
  monto_base_usd: number | null;
  monto_pagado: number | null;
  forma_pago: string | null;
  link_factura: string | null;
  link_comprobante: string | null;
  estado: string | null;
  honorarios: number | null;
  costo_total: number | null;
  porcentaje_admin: number | null;
  tasa_binance: number | null;
  tasa_usada: string | null;
  porcentaje_brecha_real: number | null;
  /** En el esquema live es numeric; puede venir vacío. */
  pool_asignado: number | null;
  avance_fisico: number | null;
};

/** Payload de alta desde el formulario CCO. */
export type CreateGastoCcoInput = {
  clase?: string | null;
  fecha?: string | null;
  proveedor?: string | null;
  tipo?: string | null;
  capitulo?: string | null;
  subcapitulo?: string | null;
  descripcion?: string | null;
  contrato_vinculado?: string | null;
  moneda?: string | null;
  tasa?: number | null;
  monto_orig?: number | null;
  monto_base_usd?: number | null;
  monto_pagado?: number | null;
  forma_pago?: string | null;
  link_factura?: string | null;
  link_comprobante?: string | null;
  estado?: string | null;
  honorarios?: number | null;
  costo_total?: number | null;
  porcentaje_admin?: number | null;
  tasa_binance?: number | null;
  tasa_usada?: string | null;
  porcentaje_brecha_real?: number | null;
  pool_asignado?: number | null;
  avance_fisico?: number | null;
};

export type MetricasCco = {
  totalRegistros: number;
  sumaCostoTotal: number;
  sumaMontoPagado: number;
  sumaHonorarios: number;
  promedioAvanceFisico: number | null;
  /** Promedio de porcentaje_brecha_real por fila (excluye null). */
  promedioBrechaReal: number | null;
  sumaMontoBaseUsd: number;
  countGastos: number;
  countIngresos: number;
};
