/** Límites PostgreSQL `numeric(precision, scale)` (error 22003 si se exceden). */

/** Máximo seguro para `numeric(15,2)` (13 dígitos enteros). Entero exacto en IEEE double. */
export const MAX_NUMERIC_15_2 = 9999999999999;
export const MIN_NUMERIC_15_2 = -MAX_NUMERIC_15_2;

export const MAX_NUMERIC_15_4 = 99999999999.9999;
export const MIN_NUMERIC_15_4 = -MAX_NUMERIC_15_4;

export const MAX_NUMERIC_15_6 = 999999999.999999;
export const MIN_NUMERIC_15_6 = -MAX_NUMERIC_15_6;

export const MAX_NUMERIC_8_4 = 9999.9999;
export const MIN_NUMERIC_8_4 = -MAX_NUMERIC_8_4;

/** Valores con |n| ≥ 10¹³ no caben en `numeric(15,2)` (suelen ser códigos/IDs mal leídos). */
const PG_NUMERIC_15_2_ABS_LIMIT = 1e13;

function roundScale(n: number, scale: number): number {
  const f = 10 ** scale;
  return Math.round(n * f) / f;
}

/** Número listo para PostgREST `numeric(15,2)` (evita 1e+21 y redondeos fuera de rango). */
export function toPgNumeric15_2(n: number): number {
  return Number(clampNumeric15_2(n).toFixed(2));
}

export function toPgNumeric15_4(n: number): number {
  return Number(clampNumeric15_4(n).toFixed(4));
}

export function clampNumeric15_2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= PG_NUMERIC_15_2_ABS_LIMIT) {
    return n > 0 ? MAX_NUMERIC_15_2 : MIN_NUMERIC_15_2;
  }
  const r = roundScale(n, 2);
  if (r > MAX_NUMERIC_15_2) return MAX_NUMERIC_15_2;
  if (r < MIN_NUMERIC_15_2) return MIN_NUMERIC_15_2;
  return r;
}

export function clampNumeric15_4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1e11) {
    return n > 0 ? MAX_NUMERIC_15_4 : MIN_NUMERIC_15_4;
  }
  const r = roundScale(n, 4);
  if (r > MAX_NUMERIC_15_4) return MAX_NUMERIC_15_4;
  if (r < MIN_NUMERIC_15_4) return MIN_NUMERIC_15_4;
  return r;
}

export function clampNumeric15_6(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const r = roundScale(n, 6);
  if (r > MAX_NUMERIC_15_6) return MAX_NUMERIC_15_6;
  if (r < MIN_NUMERIC_15_6) return MIN_NUMERIC_15_6;
  return r;
}

export function clampNumeric8_4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const r = roundScale(n, 4);
  if (r > MAX_NUMERIC_8_4) return MAX_NUMERIC_8_4;
  if (r < MIN_NUMERIC_8_4) return MIN_NUMERIC_8_4;
  return r;
}

/** Monto de partida: cantidad × precio acotado a `numeric(15,2)`. */
export function montoPartidaDesdeCantidadPrecio(
  cantidad: number,
  precio: number,
  montoExplicito?: number,
): number {
  const c = clampNumeric15_4(cantidad);
  const p = clampNumeric15_4(precio);
  const explicito = Number(montoExplicito);
  if (Number.isFinite(explicito) && explicito > 0) {
    return toPgNumeric15_2(explicito);
  }
  return toPgNumeric15_2(c * p);
}

export type PartidaLuloNumericFields = {
  cantidad_presupuestada: number;
  precio_unitario_estimado: number;
  monto_total_estimado: number;
};

/** Última línea de defensa antes de insertar en `ci_presupuesto_partidas`. */
export function sanitizePartidaNumericFields<
  T extends Partial<PartidaLuloNumericFields>,
>(row: T): T & PartidaLuloNumericFields {
  const cantidadOk = toPgNumeric15_4(Number(row.cantidad_presupuestada));
  const precioOk = toPgNumeric15_4(Number(row.precio_unitario_estimado));
  const montoOk = montoPartidaDesdeCantidadPrecio(
    cantidadOk,
    precioOk,
    Number(row.monto_total_estimado),
  );
  return {
    ...row,
    cantidad_presupuestada: cantidadOk,
    precio_unitario_estimado: precioOk,
    monto_total_estimado: montoOk,
  };
}
