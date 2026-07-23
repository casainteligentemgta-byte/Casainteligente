/** Doble tasa / brecha devaluación (BCV vs Binance). */

export function calcularBrechaPct(tasaBcv: number, tasaBinance: number): number {
  const bcv = Number(tasaBcv);
  const bin = Number(tasaBinance);
  if (!Number.isFinite(bcv) || bcv <= 0 || !Number.isFinite(bin) || bin <= 0) return 0;
  return Math.round(((bin - bcv) / bcv) * 10000) / 100;
}

export function usdDesdeVes(montoVes: number, tasa: number): number {
  const ves = Number(montoVes);
  const t = Number(tasa);
  if (!Number.isFinite(ves) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.round((ves / t) * 10000) / 10000;
}

/**
 * Contabilidad Real V4: convierte USD a tasa oficial (BCV) hacia poder de compra
 * a tasa paralela (Binance).
 *
 * Dos convenciones de `devaluacionPct` (equivalentes en magnitud):
 * - Positiva (UI / import TS): p.ej. 34.45 → real = oficial / (1 + 0.3445)
 * - Negativa (KPIs Python / factor-1): p.ej. -25.622 → real = oficial * (1 - 0.25622)
 *   (= oficial * factor, con factor = ingresos_real / ingresos_bcv)
 */
export function aplicarFactorDevaluacion(montoUsd: number, devaluacionPct: number): number {
  const m = Number(montoUsd) || 0;
  const d = Number(devaluacionPct) || 0;
  if (!Number.isFinite(m)) return 0;
  if (!Number.isFinite(d) || d === 0) return m;

  if (d > 0) {
    return m / (1 + d / 100);
  }

  // d < 0 → factor Python (1 + d/100) ∈ (0, 1)
  const factor = 1 + d / 100;
  if (factor <= 0) return m;
  return m * factor;
}

/** % devaluación implícito dado oficial (BCV) vs real (Binance). */
export function devaluacionPctDesdeOficialYReal(oficialUsd: number, realUsd: number): number {
  const o = Number(oficialUsd);
  const r = Number(realUsd);
  if (!Number.isFinite(o) || !Number.isFinite(r) || o <= 0 || r <= 0) return 0;
  return Math.round((o / r - 1) * 10000) / 100;
}

export function elegirTasaUsada(opts: {
  moneda: string;
  tasaBcv?: number | null;
  tasaBinance?: number | null;
  preferida?: 'BCV' | 'BINANCE' | string | null;
}): { tasa: number; usada: 'BCV' | 'BINANCE' | 'USD' } {
  const moneda = String(opts.moneda || 'USD').toUpperCase();
  if (moneda === 'USD') return { tasa: 1, usada: 'USD' };
  const pref = String(opts.preferida || 'BCV').toUpperCase();
  const bin = Number(opts.tasaBinance);
  const bcv = Number(opts.tasaBcv);
  if (pref === 'BINANCE' && Number.isFinite(bin) && bin > 0) {
    return { tasa: bin, usada: 'BINANCE' };
  }
  if (Number.isFinite(bcv) && bcv > 0) return { tasa: bcv, usada: 'BCV' };
  if (Number.isFinite(bin) && bin > 0) return { tasa: bin, usada: 'BINANCE' };
  return { tasa: 1, usada: 'USD' };
}
