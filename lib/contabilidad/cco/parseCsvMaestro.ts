/** Helpers de montos CSV / sync FDW (paridad Streamlit V4). */

export function round2HalfUp(n: number): number {
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(Number(n));
  const cents = Math.round((abs + Number.EPSILON) * 100) / 100;
  return sign * cents;
}

/**
 * Recalcula MONTO BASE USD / HONORARIOS / COSTO TOTAL como Streamlit V4.
 */
export function applyDerivedCsvMontos(
  input: {
    clase?: string | null;
    moneda?: string | null;
    monto_orig?: number | null;
    monto_base_usd?: number | null;
    honorarios?: number | null;
    costo_total?: number | null;
    porcentaje_admin?: number | null;
    tasa?: number | null;
  },
  adminDefault = 15,
): {
  monto_base_usd: number | null;
  honorarios: number | null;
  costo_total: number | null;
  porcentaje_admin: number | null;
} {
  const clase = String(input.clase ?? 'GASTO').trim().toUpperCase();
  const moneda = String(input.moneda ?? 'USD').trim().toUpperCase();
  const montoOrig = Number(input.monto_orig) || 0;
  const tasa = Number(input.tasa) || 0;
  let base: number | null = montoOrig;
  if (moneda && moneda !== 'USD' && montoOrig > 0 && tasa > 0) {
    base = montoOrig / tasa;
  } else if (!base) {
    base = Number(input.monto_base_usd) || 0;
  }
  base = base > 0 ? round2HalfUp(base) : null;

  let pct = Number(input.porcentaje_admin);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) pct = adminDefault;

  let honorarios = input.honorarios;
  let costoTotal = input.costo_total;

  if (clase === 'GASTO' && base != null) {
    honorarios = round2HalfUp(base * (pct / 100));
    costoTotal = round2HalfUp(base + honorarios);
  } else if (clase === 'INGRESO' && base != null) {
    honorarios = 0;
    costoTotal = base;
  }

  return {
    monto_base_usd: base,
    honorarios: honorarios ?? null,
    costo_total: costoTotal ?? null,
    porcentaje_admin: pct,
  };
}
