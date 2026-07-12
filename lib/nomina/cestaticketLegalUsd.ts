import { bonoUsdABs } from '@/lib/nomina/tasaBcvVesPorUsd';

/** Cestaticket mensual de referencia legal (USD) para liquidación express y textos de contrato. */
export const CESTATICKET_MENSUAL_USD = 40;
/** Alícuota semanal (mensual ÷ 4) en USD. */
export const CESTATICKET_SEMANAL_USD = 10;

/** Convierte la alícuota semanal de cestaticket (10 USD) a bolívares con la tasa BCV del día de pago (ref. operativa en env). */
export function cestaticketSemanalBolivaresAlTipoCambioBcV(tasaBsPorUsd: number): number {
  if (!Number.isFinite(tasaBsPorUsd) || tasaBsPorUsd <= 0) return 0;
  return Math.round(bonoUsdABs(CESTATICKET_SEMANAL_USD, tasaBsPorUsd) * 100) / 100;
}
