export type MonedaOrigen = 'VES' | 'USD';

export interface BimonetarioResult {
  montoVes: number;
  montoUsd: number;
  tasaApplied: number;
}

/**
 * Normaliza un gasto calculando su contraparte en la otra divisa
 * según la tasa oficial del BCV del día (bolívares por 1 USD).
 */
export function calcularGastoBimonetario(
  monto: number,
  monedaOrigen: MonedaOrigen,
  tasaBcvActual: number,
): BimonetarioResult {
  const m = Number(monto);
  const tasa = Number(tasaBcvActual);
  if (!Number.isFinite(m) || m < 0 || !Number.isFinite(tasa) || tasa <= 0) {
    return { montoVes: 0, montoUsd: 0, tasaApplied: tasa > 0 ? tasa : 0 };
  }

  if (monedaOrigen === 'USD') {
    return {
      montoUsd: m,
      montoVes: Math.round(m * tasa * 100) / 100,
      tasaApplied: tasa,
    };
  }

  return {
    montoVes: m,
    montoUsd: Math.round((m / tasa) * 100) / 100,
    tasaApplied: tasa,
  };
}

/** Bolívares → USD (alias sobre {@link calcularGastoBimonetario}). */
export function montoVesAUsd(totalVes: number, tasaBcvVesPorUsd: number): number {
  return calcularGastoBimonetario(totalVes, 'VES', tasaBcvVesPorUsd).montoUsd;
}

/** USD → bolívares (alias sobre {@link calcularGastoBimonetario}). */
export function montoUsdAVes(totalUsd: number, tasaBcvVesPorUsd: number): number {
  return calcularGastoBimonetario(totalUsd, 'USD', tasaBcvVesPorUsd).montoVes;
}
