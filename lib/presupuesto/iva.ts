/**
 * IVA del presupuesto comercial y equivalente referencial en bolívares.
 * 16 % por defecto; 0 = exento.
 */
export const IVA_PCT_DEFAULT = 16;

export function redondearCentimos(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** 0 = exento; cualquier otro valor inválido cae al 16 %. */
export function normalizarIvaPct(v: unknown): number {
  if (v == null || v === '') return IVA_PCT_DEFAULT;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return IVA_PCT_DEFAULT;
  if (n === 0) return 0;
  return Math.min(100, redondearCentimos(n));
}

export function esExentoIva(pct: number | null | undefined): boolean {
  return normalizarIvaPct(pct) <= 0;
}

export function ivaMontoDe(subtotal: number, ivaPct: number): number {
  const base = Math.max(0, redondearCentimos(subtotal));
  const pct = normalizarIvaPct(ivaPct);
  if (pct <= 0) return 0;
  return redondearCentimos((base * pct) / 100);
}

export function totalConIvaDe(subtotal: number, ivaPct: number): number {
  const base = Math.max(0, redondearCentimos(subtotal));
  return redondearCentimos(base + ivaMontoDe(base, ivaPct));
}

export function etiquetaIva(ivaPct: number): string {
  const pct = normalizarIvaPct(ivaPct);
  return pct <= 0 ? 'IVA (exento)' : `IVA (${pct}%)`;
}

/** Descuento en USD de una línea (precio × cantidad × % / 100). */
export function descuentoLineaUsd(unitPrice: number, discountPct: number, qty: number): number {
  const bruto = redondearCentimos((Number(unitPrice) || 0) * (Number(qty) || 0));
  const pct = Math.max(0, Number(discountPct) || 0);
  return redondearCentimos((bruto * pct) / 100);
}

export function totalReferencialBs(totalUsd: number, tasaBcv: number): number | null {
  const usd = Number(totalUsd);
  const tasa = Number(tasaBcv);
  if (!Number.isFinite(usd) || usd < 0 || !Number.isFinite(tasa) || tasa <= 0) return null;
  return redondearCentimos(usd * tasa);
}

export function formatearUsdPresupuesto(n: number): string {
  return `$${redondearCentimos(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatearBsPresupuesto(n: number): string {
  return `Bs. ${redondearCentimos(n).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function esErrorColumnaIva(message: string | null | undefined): boolean {
  return /iva_pct|iva_monto|column.*iva/i.test(String(message ?? ''));
}
