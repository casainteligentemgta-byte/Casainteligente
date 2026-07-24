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
  /** Avance físico/acuerdo (0–100). Lo fija el operador; no se deriva de pagos. */
  pct_avance: number;
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
  /** ID visible (origen V4 o correlativo). */
  display_id: number | string;
  origen_v4_id: number | null;
  clase: CcoClase;
  fecha: string | null;
  proveedor: string;
  tipo: string;
  capitulo: string;
  subcapitulo: string;
  descripcion: string;
  moneda: string;
  tasa: number;
  monto_orig: number;
  pct_distribucion: number;
  admin_pct: number;
  monto_base_usd: number;
  honorarios_usd: number;
  costo_total_usd: number;
  estado: string;
  forma_pago: string | null;
  invoice_number: string | null;
  /**
   * Referencia de factura para UI V4.
   * Si hay documento en Storage (o vía purchase_invoice), apunta a la API de documento.
   * null → «None» / permitir adjuntar desde egresos.
   */
  link_factura: string | null;
  /** True si la compra tiene PDF/imagen en Storage o factura de recepción vinculada. */
  tiene_documento: boolean;
  document_file_name: string | null;
  /** Monto pagado USD (V4); null si no informado. */
  monto_pagado_usd: number | null;
  tasa_binance: number;
  tasa_usada: string | null;
  porcentaje_brecha_real: number | null;
  /** Etiqueta corta del contrato vinculado (si hay). */
  contrato_label: string | null;
  /** Clave para «Agrupar Gastos Divididos»; null si no es split. */
  split_group_key: string | null;
  contrato_obra_id: string | null;
  fuente: 'compra' | 'inyeccion' | 'contrato' | 'presupuesto' | 'auditoria';
};
