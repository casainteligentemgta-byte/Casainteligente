import {
  calcularGastoBimonetario,
  type MonedaOrigen,
} from '@/lib/finanzas/currency-converter';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export type MontosCompraBimonetario = {
  montoVes: number;
  montoUsd: number;
  tasaApplied: number;
  monedaOriginal: MonedaOrigen;
  /** `total_amount` en tablas legacy (siempre en bolívares). */
  totalAmountLegacy: number;
};

export type ResolverMontosCompraInput = {
  montoTotal: number;
  moneda?: MonedaOrigen | string | null;
  fecha: string;
  tasaBcvDigitada?: number | null;
};

function normalizarMoneda(moneda?: MonedaOrigen | string | null): MonedaOrigen {
  const m = String(moneda ?? 'VES')
    .trim()
    .toUpperCase();
  return m === 'USD' ? 'USD' : 'VES';
}

/**
 * Calcula VES/USD con tasa BCV y deja listo el payload de inserción bimonetario.
 */
export async function resolverMontosCompraBimonetario(
  input: ResolverMontosCompraInput,
): Promise<MontosCompraBimonetario> {
  const monedaOriginal = normalizarMoneda(input.moneda);
  const monto = Number(input.montoTotal);
  if (!Number.isFinite(monto) || monto < 0) {
    return {
      montoVes: 0,
      montoUsd: 0,
      tasaApplied: 0,
      monedaOriginal,
      totalAmountLegacy: 0,
    };
  }

  let tasa = Number(input.tasaBcvDigitada);
  if (!Number.isFinite(tasa) || tasa <= 0) {
    const tasaRes = await resolverTasaBcvVesPorUsd(input.fecha, input.tasaBcvDigitada);
    tasa = tasaRes.tasa_bcv_ves_por_usd;
  }

  const { montoVes, montoUsd, tasaApplied } = calcularGastoBimonetario(
    monto,
    monedaOriginal,
    tasa,
  );

  return {
    montoVes,
    montoUsd,
    tasaApplied,
    monedaOriginal,
    totalAmountLegacy: montoVes,
  };
}

/** Campos comunes para insert/update en compras (contabilidad + recepción). */
export function payloadCompraBimonetario(montos: MontosCompraBimonetario) {
  return {
    moneda: montos.monedaOriginal,
    moneda_original: montos.monedaOriginal,
    total_amount: montos.totalAmountLegacy,
    monto_ves: montos.montoVes,
    monto_usd: montos.montoUsd,
    tasa_bcv_ves_por_usd: montos.tasaApplied,
    total_amount_usd: montos.montoUsd,
  };
}
