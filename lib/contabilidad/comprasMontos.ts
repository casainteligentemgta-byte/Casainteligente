import { montoVesAUsd } from '@/lib/finanzas/currency-converter';

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
    return montoVesAUsd(ves, tasa);
  }
  return Number.isFinite(ves) ? ves : 0;
}

export function montoVesCompra(row: { total_amount: number; monto_ves?: number | null }): number {
  if (row.monto_ves != null && Number.isFinite(Number(row.monto_ves))) {
    return Number(row.monto_ves);
  }
  const ves = Number(row.total_amount);
  return Number.isFinite(ves) ? ves : 0;
}

export function tasaBcvCompra(row: { tasa_bcv_ves_por_usd?: number | null }): number | null {
  const t = Number(row.tasa_bcv_ves_por_usd);
  return Number.isFinite(t) && t > 0 ? t : null;
}

/** Convierte un monto en bolívares a USD con la tasa de la compra (o null si no hay tasa). */
export function vesAUsdConTasa(ves: number, tasa: number | null | undefined): number | null {
  const t = Number(tasa);
  if (!Number.isFinite(ves) || ves < 0 || !Number.isFinite(t) || t <= 0) return null;
  return montoVesAUsd(ves, t);
}

export function formatearUsd(monto: number): string {
  return `$${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatearBs(monto: number): string {
  return `Bs. ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatearTasaBcv(tasa: number): string {
  return `${tasa.toLocaleString('es-VE', { maximumFractionDigits: 2 })} Bs/USD`;
}

/** Texto compacto: USD · Bs · tasa (para tooltips o aria-label). */
export function lineaBimonetariaCompra(
  usd: number | null,
  bs: number,
  tasa: number | null | undefined,
  opts?: { tasaEsDelDia?: boolean },
): string {
  const parts: string[] = [];
  if (usd != null && Number.isFinite(usd)) parts.push(formatearUsd(usd));
  if (Number.isFinite(bs)) parts.push(formatearBs(bs));
  if (tasa != null && tasa > 0) {
    parts.push(formatearTasaBcv(tasa) + (opts?.tasaEsDelDia ? ' (día)' : ''));
  }
  return parts.join(' · ');
}
