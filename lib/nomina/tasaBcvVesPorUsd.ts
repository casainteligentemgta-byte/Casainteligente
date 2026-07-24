/**
 * Tasa **oficial** BCV: bolívares por **un** dólar (Bs/USD), para convertir montos en USD a VES al día de pago.
 *
 * Configura `NEXT_PUBLIC_TASA_BCV_VES_POR_USD` en el entorno (actualízala el día del pago, p. ej. cada viernes).
 * No sustituye un feed oficial del BCV; es la referencia operativa que usa la app hasta integrar API si aplica.
 */
export function tasaBcvVesPorUsdFromEnv(): number | null {
  const raw = process.env.NEXT_PUBLIC_TASA_BCV_VES_POR_USD;
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Monto en bolívares = USD × tasa (Bs por USD). */
export function bonoUsdABs(usd: number, tasaBsPorUsd: number): number {
  const u = Number(usd);
  const t = Number(tasaBsPorUsd);
  if (!Number.isFinite(u) || u < 0 || !Number.isFinite(t) || t <= 0) return 0;
  return u * t;
}
