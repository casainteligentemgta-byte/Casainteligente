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
