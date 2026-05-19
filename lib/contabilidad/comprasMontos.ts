/** Monto en USD para listados y totales (compras contables). */
export function montoUsdCompra(row: {
  total_amount: number;
  monto_usd?: number | null;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
}): number {
  if (row.monto_usd != null && Number.isFinite(Number(row.monto_usd))) {
    return Number(row.monto_usd);
  }
  if (row.total_amount_usd != null && Number.isFinite(Number(row.total_amount_usd))) {
    return Number(row.total_amount_usd);
  }
  const tasa = Number(row.tasa_bcv_ves_por_usd);
  const ves = Number(row.total_amount);
  if (tasa > 0 && Number.isFinite(ves)) {
    return Math.round((ves / tasa) * 100) / 100;
  }
  return Number.isFinite(ves) ? ves : 0;
}
