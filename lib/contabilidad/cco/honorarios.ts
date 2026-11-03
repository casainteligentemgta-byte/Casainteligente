/** Fórmulas de honorarios / costo total CCO V4. */

export const HONORARIOS_ADMIN_PCT_DEFAULT = 15;

/**
 * 0% es un valor válido (p. ej. TH-4 con honorarios_admin_pct = 0).
 * Solo usa 15 cuando el valor está ausente o no es numérico.
 */
export function honorariosAdminPctODefault(
  value: unknown,
  fallback = HONORARIOS_ADMIN_PCT_DEFAULT,
): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function calcularHonorarios(montoBaseUsd: number, adminPct: number): number {
  const base = Number(montoBaseUsd) || 0;
  const pct = Number(adminPct) || 0;
  if (base <= 0 || pct <= 0) return 0;
  return Math.round(base * (pct / 100) * 10000) / 10000;
}

/**
 * % ADMIN de la fila si viene informado (incluido 0);
 * si no, % global de la obra; si el global también falta, 15.
 */
export function resolverAdminPct(
  pctFila: number | null | undefined,
  pctGlobal: number | null | undefined,
): number {
  if (pctFila != null && Number.isFinite(Number(pctFila))) return Number(pctFila);
  return honorariosAdminPctODefault(pctGlobal);
}

export function calcularCostoTotal(montoBaseUsd: number, honorariosUsd: number): number {
  return (Number(montoBaseUsd) || 0) + (Number(honorariosUsd) || 0);
}

export function aplicarHonorariosABase(
  montoBaseUsd: number,
  pctFila: number | null | undefined,
  pctGlobal: number,
): { adminPct: number; honorariosUsd: number; costoTotalUsd: number } {
  const adminPct = resolverAdminPct(pctFila, pctGlobal);
  const honorariosUsd = calcularHonorarios(montoBaseUsd, adminPct);
  return {
    adminPct,
    honorariosUsd,
    costoTotalUsd: calcularCostoTotal(montoBaseUsd, honorariosUsd),
  };
}
