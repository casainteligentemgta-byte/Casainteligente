/**
 * Eficiencia y rentabilidad diaria para avance de campo (LuloWin).
 */

export function calcularEficienciaCampo(
  cantidadEjecutadaHoy: number,
  rendimientoTeorico: number,
): number {
  const rend = rendimientoTeorico > 0 ? rendimientoTeorico : 1;
  const cant = Math.max(0, cantidadEjecutadaHoy);
  return Math.round((cant / rend) * 10000) / 100;
}

/** Valor generado (cantidad × P.U.) menos costo directo estimado (cantidad × costo APU unitario). */
export function calcularRentabilidadDiaria(
  cantidadEjecutadaHoy: number,
  precioUnitarioVenta: number,
  costoDirectoUnitario: number,
): number {
  const cant = Math.max(0, cantidadEjecutadaHoy);
  const pu = Math.max(0, precioUnitarioVenta);
  const cd = Math.max(0, costoDirectoUnitario);
  const valor = cant * pu;
  const costo = cant * cd;
  return Math.round((valor - costo) * 100) / 100;
}

export function emojiEficiencia(pct: number): string {
  if (pct >= 100) return '📈';
  if (pct >= 80) return '✅';
  if (pct >= 50) return '⚠️';
  return '📉';
}
