/** Tipos del libro CCO V4 (traducidos a Casa Inteligente). */

export const CCO_CLASES = [
  'GASTO',
  'INGRESO',
  'CONTRATO',
  'PRESUPUESTO',
  'AUDITORIA',
] as const;

export type CcoClase = (typeof CCO_CLASES)[number];

export type CcoContratoObra = {
  id: string;
  proyecto_id: string;
  proveedor: string;
  descripcion: string;
  fecha: string | null;
  moneda: string;
  monto_base_usd: number;
  admin_pct: number;
  honorarios_usd: number;
  costo_total_usd: number;
  estado: string;
  tipo_gasto_cco: string | null;
  origen_v4_id: number | null;
};

export type CcoPagoVinculado = {
  id: string;
  fecha: string | null;
  proveedor: string;
  descripcion: string;
  monto_usd: number;
  tipo_gasto_cco: string | null;
  capitulo_cco: string | null;
  estado: string | null;
};

export type CcoContratoConSaldo = CcoContratoObra & {
  monto_pagado_usd: number;
  saldo_usd: number;
  pct_avance: number;
  pagos: CcoPagoVinculado[];
};

export type CcoProveedorContratos = {
  proveedor: string;
  contratos: CcoContratoConSaldo[];
  total_contratado: number;
  total_pagado: number;
  total_saldo: number;
};

export type CcoLibroFila = {
  id: string;
  clase: CcoClase;
  fecha: string | null;
  proveedor: string;
  tipo: string;
  capitulo: string;
  subcapitulo: string;
  descripcion: string;
  moneda: string;
  monto_base_usd: number;
  honorarios_usd: number;
  costo_total_usd: number;
  estado: string;
  contrato_obra_id: string | null;
  fuente: 'compra' | 'inyeccion' | 'contrato' | 'presupuesto' | 'auditoria';
  /** Campos extendidos (registros_gastos / CSV RANCHO). */
  contrato_vinculado?: string | null;
  tasa?: number | null;
  monto_orig?: number | null;
  monto_pagado?: number | null;
  forma_pago?: string | null;
  link_factura?: string | null;
  link_comprobante?: string | null;
  porcentaje_admin?: number | null;
  tasa_binance?: number | null;
  tasa_usada?: string | null;
  porcentaje_brecha_real?: number | null;
  pool_asignado?: number | null;
  avance_fisico?: number | null;
  /** True cuando la fila proviene de registros_gastos (editable/borrable). */
  editable?: boolean;
};
