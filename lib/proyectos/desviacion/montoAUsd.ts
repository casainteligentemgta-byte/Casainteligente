import { round2 } from '@/lib/proyectos/jornales/calcularJornalesSemana';

export type MontoFuenteAUsdInput = {
  montoUsd?: number | null;
  montoVes?: number | null;
  totalAmount?: number | null;
  moneda?: string | null;
  tasaAlmacenada?: number | null;
  tasaFallback: number;
};

function numPos(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function monedaUsd(moneda?: string | null): boolean {
  return String(moneda ?? '')
    .trim()
    .toUpperCase() === 'USD';
}

/**
 * Convierte un monto de compra/presupuesto a USD.
 * Prioriza `monto_usd` persistido; si la fuente está en VES usa la tasa del registro
 * y, si falta, la tasa BCV de respaldo.
 */
export function montoFuenteAUsd(input: MontoFuenteAUsdInput): number {
  const usdDirecto = numPos(input.montoUsd);
  if (usdDirecto) return round2(usdDirecto);

  const tasa =
    numPos(input.tasaAlmacenada) ??
    (Number.isFinite(input.tasaFallback) && input.tasaFallback > 0 ? input.tasaFallback : 0);

  if (monedaUsd(input.moneda)) {
    const usd = numPos(input.totalAmount) ?? numPos(input.montoVes);
    if (usd) return round2(usd);
    return 0;
  }

  const ves = numPos(input.montoVes) ?? numPos(input.totalAmount);
  if (!ves || !tasa) return 0;
  return round2(ves / tasa);
}

export function costoEgresoLineaUsd(args: {
  cantidad: number;
  averageWeightedCost?: number | null;
  lastPurchasePrice?: number | null;
}): number {
  const cant = Number(args.cantidad);
  if (!Number.isFinite(cant) || cant <= 0) return 0;
  const unit =
    numPos(args.averageWeightedCost) ?? numPos(args.lastPurchasePrice) ?? 0;
  return round2(cant * unit);
}
