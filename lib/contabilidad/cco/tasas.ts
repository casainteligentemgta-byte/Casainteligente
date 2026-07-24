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

export function aplicarFactorDevaluacion(montoUsd: number, devaluacionPct: number): number {
  const m = Number(montoUsd) || 0;
  const d = Number(devaluacionPct) || 0;
  return m * (1 + d / 100);
}

/**
 * El CSV maestro suele traer brecha Binance/BCV positiva (p. ej. +34,45%).
 * Contabilidad Real en V4 aplica devaluación como factor (1 + d/100) con d negativo
 * (poder adquisitivo): +34,45% → ≈ −25,62%.
 */
export function brechaCsvADevaluacionV4(brechaPct: number): number {
  const avg = Number(brechaPct);
  if (!Number.isFinite(avg) || avg === 0) return 0;
  const deval = avg > 0 && avg < 200 ? (-avg / (100 + avg)) * 100 : avg;
  return Math.round(deval * 100000) / 100000;
}

/**
 * Si la config quedó con la brecha cruda (>0), la normaliza a forma V4.
 * Valores ya negativos (o fuera del rango de spread) se respetan.
 */
export function normalizarDevaluacionConfig(devaluacionPct: number): number {
  const d = Number(devaluacionPct);
  if (!Number.isFinite(d) || d === 0) return 0;
  if (d > 0 && d < 200) return brechaCsvADevaluacionV4(d);
  return Math.round(d * 100000) / 100000;
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
