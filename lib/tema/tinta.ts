/**
 * Colores translúcidos que sirven en claro y en oscuro.
 *
 * Las pantallas se escribieron para fondo negro, con blancos translúcidos del tipo
 * `rgba(255,255,255,0.45)`. Aquí la «tinta» es blanca en oscuro y negra en claro, así que
 * la misma línea de código da el mismo resultado de antes en oscuro y su equivalente en claro.
 */

/** Rellenos, bordes y líneas: `tinta(0.1)` era `rgba(255,255,255,0.1)`. */
export function tinta(opacidad: number): string {
  return `rgb(var(--tinta) / ${opacidad})`;
}

/**
 * Texto translúcido: `tintaTexto(0.45)` era `rgba(255,255,255,0.45)`.
 * En claro se marca un poco más (`--tinta-realce`) porque el gris sobre blanco se lee peor
 * que el gris sobre negro.
 */
export function tintaTexto(opacidad: number): string {
  return `rgb(var(--tinta) / calc(${opacidad} * var(--tinta-realce, 1)))`;
}
