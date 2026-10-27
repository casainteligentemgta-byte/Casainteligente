/** Máximo de caracteres del nombre en el botón (en el teléfono caben ~30 con emoji y conteo). */
const MAX_NOMBRE_BOTON = 24;

/** Sufijos legales al final del nombre que no sirven para reconocer al proveedor en el botón. */
const SUFIJOS_LEGALES =
  /[\s,.-]*(?:(?:S\.?\s?R\.?\s?L\.?|C\.?\s?A\.?|G\.?\s?P\.?|F\.?\s?P\.?|S\.?\s?A\.?)[\s,.-]*)+$/i;

/** Nombre corto del proveedor para el botón: sin sufijos legales y con tope de largo. */
export function nombreCortoProveedor(nombre: string): string {
  const sinSufijos = nombre.trim().replace(/\s+/g, ' ').replace(SUFIJOS_LEGALES, '').trim();
  const base = sinSufijos || nombre.trim();
  return base.length <= MAX_NOMBRE_BOTON ? base : `${base.slice(0, MAX_NOMBRE_BOTON - 1).trimEnd()}…`;
}

/** Texto del botón de proveedor: emoji, nombre corto y cantidad de facturas. */
export function etiquetaProveedorBoton(nombre: string, count: number): string {
  return `🏢 ${nombreCortoProveedor(nombre)} (${count})`;
}
