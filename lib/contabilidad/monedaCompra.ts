import {
  calcularGastoBimonetario,
  type MonedaOrigen,
} from '@/lib/finanzas/currency-converter';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import { montoUsdCompra, montoVesCompra, vesAUsdConTasa } from '@/lib/contabilidad/comprasMontos';

export type FilaMonedaCompra = {
  total_amount: number;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  moneda?: string | null;
  moneda_original?: string | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
};

export type FilaMontoLineaCompra = {
  esLinea: boolean;
  cantidad: number;
  precioUnitario: number;
  montoBs: number;
  montoUsd?: number | null;
  monedaOriginal?: MonedaOrigen | string | null;
  tasaBcv?: number | null;
};

export function monedaOriginalCompra(row: FilaMonedaCompra): MonedaOrigen {
  return normalizarMonedaExtracted(row.moneda_original ?? row.moneda);
}

/** Monto impreso en la factura (en la moneda original antes del cambio). */
export function montoNominalMonedaOriginal(row: FilaMonedaCompra): number {
  const moneda = monedaOriginalCompra(row);
  if (moneda === 'USD') {
    const usd = row.monto_usd ?? row.total_amount_usd;
    if (usd != null && Number.isFinite(Number(usd))) return Number(usd);
    const tasa = Number(row.tasa_bcv_ves_por_usd);
    const ves = montoVesCompra(row);
    if (tasa > 0 && ves > 0) return Math.round((ves / tasa) * 100) / 100;
    return Number(row.total_amount) || 0;
  }
  return montoVesCompra(row);
}

/** Montos Bs/USD para listado según moneda original de la factura. */
export function montosBimonetariosLista(
  row: FilaMonedaCompra,
  tasa: number | null | undefined,
): { bs: number; usd: number | null; moneda: MonedaOrigen } {
  const moneda = monedaOriginalCompra(row);
  const nominal = montoNominalMonedaOriginal(row);
  const t = Number(tasa);

  if (Number.isFinite(t) && t > 0 && nominal > 0) {
    const { montoVes, montoUsd } = calcularGastoBimonetario(nominal, moneda, t);
    return { bs: montoVes, usd: montoUsd, moneda };
  }

  const bs = montoVesCompra(row);
  const usd = montoUsdCompra(row);
  return { bs, usd: Number.isFinite(usd) && usd > 0 ? usd : null, moneda };
}

/** Subtotal nominal de una fila (línea o cabecera) en la moneda original de la factura. */
export function subtotalNominalLineaCompra(row: FilaMontoLineaCompra): number {
  return row.esLinea ? row.cantidad * row.precioUnitario : row.montoBs;
}

/** Convierte subtotal de línea/cabecera a bolívares según moneda original. */
export function subtotalBsLineaCompra(row: FilaMontoLineaCompra): number {
  const nominal = subtotalNominalLineaCompra(row);
  const moneda = normalizarMonedaExtracted(row.monedaOriginal);
  if (moneda === 'USD') {
    const t = Number(row.tasaBcv);
    if (Number.isFinite(t) && t > 0) {
      return Math.round(nominal * t * 100) / 100;
    }
  }
  return nominal;
}

/** Equivalente USD de una fila de línea/cabecera. */
export function subtotalUsdLineaCompra(row: FilaMontoLineaCompra): number | null {
  const nominal = subtotalNominalLineaCompra(row);
  const moneda = normalizarMonedaExtracted(row.monedaOriginal);
  const bs = subtotalBsLineaCompra(row);

  if (moneda === 'USD') {
    return Math.round(nominal * 100) / 100;
  }

  const directo = vesAUsdConTasa(bs, row.tasaBcv);
  if (directo != null) return directo;
  if (row.montoUsd != null && row.montoBs > 0) {
    return Math.round(((bs / row.montoBs) * row.montoUsd) * 100) / 100;
  }
  return row.esLinea ? null : row.montoUsd ?? null;
}
