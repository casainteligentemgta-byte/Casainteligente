/**
 * Columnas de la vista «Por factura» (cuadro de compras).
 * Primero las que Luis pidió (total de factura, no P.U.); después el resto.
 */
export const COMPRAS_FACTURAS_HEADERS_PRINCIPALES = [
  'Fecha',
  'Nº factura',
  'Proveedor',
  'RIF',
  'Producto',
  'Total (Bs)',
  'USD',
  'Entidad',
  'Almacén',
  'Proyecto',
  'Ver imagen',
  'Acciones',
] as const;

export const COMPRAS_FACTURAS_HEADERS_EXTRA = [
  'Control',
  'Tasa BCV',
  'Días crédito',
  'Vencimiento',
  'Pago',
  'Estado',
  'Origen',
  'Logística',
  'Imputación',
  'Clasificación',
  'Moneda',
  'Productos',
  'CRM',
] as const;

export const COMPRAS_FACTURAS_HEADERS = [
  ...COMPRAS_FACTURAS_HEADERS_PRINCIPALES,
  ...COMPRAS_FACTURAS_HEADERS_EXTRA,
] as const;
