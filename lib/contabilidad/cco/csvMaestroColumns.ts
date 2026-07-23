/**
 * Columnas exactas del CSV maestro Streamlit V4 (orden obligatorio).
 * Round-trip: exportar desde CI → importar en Streamlit (y viceversa).
 */

export const CSV_MAESTRO_COLUMNS = [
  'CLASE',
  'FECHA',
  'PROVEEDOR',
  'TIPO',
  'CAPITULO',
  'SUBCAPITULO',
  'DESCRIPCION',
  'CONTRATO_VINCULADO',
  'MONEDA',
  'TASA',
  'MONTO ORIG',
  'MONTO BASE USD',
  'MONTO PAGADO',
  'FORMA PAGO',
  'LINK FACTURA',
  'LINK COMPROBANTE',
  'ESTADO',
  'HONORARIOS',
  'COSTO TOTAL',
  '% ADMIN',
  'TASA BINANCE',
  'TASA USADA',
  '% BRECHA REAL',
  'POOL_ASIGNADO',
  'AVANCE_FISICO',
] as const;

export type CsvMaestroColumn = (typeof CSV_MAESTRO_COLUMNS)[number];

/** CLASE en CSV Streamlit → valor almacenado en BD (si difiere). */
export function normalizarClaseImport(clase: string): string {
  const c = clase.trim().toUpperCase();
  if (c === 'PRESUPUESTO_METADATA' || c === 'PRESUPUESTO') return 'PRESUPUESTO_METADATA';
  return c || 'GASTO';
}

/** CLASE en BD → valor exacto del CSV Streamlit. */
export function normalizarClaseExport(clase: string | null | undefined): string {
  const c = String(clase ?? 'GASTO').trim().toUpperCase();
  if (c === 'PRESUPUESTO') return 'PRESUPUESTO_METADATA';
  return c || 'GASTO';
}
