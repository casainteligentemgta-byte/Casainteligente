/**
 * Esquema único de columnas del cuadro de compras (UI, CSV, TSV, PDF).
 * Evita que encabezados y contenido se desfasen entre vistas.
 */

export const COMPRAS_CUADRO_HEADERS = [
  'Fecha',
  'Factura',
  'Proveedor',
  'RIF',
  'Almacén',
  'Artículo',
  'Código',
  'Cant.',
  'P.U.',
  'Subtotal (Bs)',
  'USD',
  'Tasa BCV',
  'Entidad',
  'Obra / Proyecto',
] as const;

export type CompraCuadroHeader = (typeof COMPRAS_CUADRO_HEADERS)[number];
