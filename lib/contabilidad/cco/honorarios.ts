/** Fórmulas de honorarios / costo total CCO V4. */

export function calcularHonorarios(montoBaseUsd: number, adminPct: number): number {
  const base = Number(montoBaseUsd) || 0;
  const pct = Number(adminPct) || 0;
  if (base <= 0 || pct <= 0) return 0;
  return Math.round(base * (pct / 100) * 10000) / 10000;
}

/**
 * En V4, si % ADMIN de la fila es 0, se usa el % global de sesión (típicamente 15).
 */
export function resolverAdminPct(
  pctFila: number | null | undefined,
  pctGlobal: number,
): number {
  const fila = Number(pctFila);
  if (Number.isFinite(fila) && fila > 0) return fila;
  const g = Number(pctGlobal);
  return Number.isFinite(g) && g > 0 ? g : 15;
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
