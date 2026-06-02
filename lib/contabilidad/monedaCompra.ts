import {
  calcularGastoBimonetario,
  type MonedaOrigen,
} from '@/lib/finanzas/currency-converter';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import {
  formatearBs,
  formatearUsd,
  montoUsdCompra,
  montoVesCompra,
  vesAUsdConTasa,
} from '@/lib/contabilidad/comprasMontos';

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
  subtotalBsLinea?: number;
  subtotalUsdLinea?: number | null;
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

/** Subtotal nominal de una fila (línea o cabecera) en la moneda original (cant × P.U.). */
export function subtotalNominalLineaCompra(row: FilaMontoLineaCompra): number {
  return row.esLinea ? row.cantidad * row.precioUnitario : row.montoBs;
}

export function esLineaCompraUsd(row: Pick<FilaMontoLineaCompra, 'monedaOriginal'>): boolean {
  return normalizarMonedaExtracted(row.monedaOriginal) === 'USD';
}

/** P.U. formateado en la moneda original de la factura (USD o Bs). */
export function formatearPrecioUnitarioLineaCompra(row: FilaMontoLineaCompra): string | null {
  if (!row.esLinea) return null;
  return esLineaCompraUsd(row)
    ? formatearUsd(row.precioUnitario)
    : formatearBs(row.precioUnitario);
}

/** Bolívares de la fila: total bimonetario prorrateado o cabecera de factura. */
export function subtotalBsLineaCompra(row: FilaMontoLineaCompra): number {
  if (row.esLinea && row.subtotalBsLinea != null && Number.isFinite(row.subtotalBsLinea)) {
    return row.subtotalBsLinea;
  }
  if (!row.esLinea) return row.montoBs;
  return subtotalNominalLineaCompra(row);
}

/** USD de la fila: total bimonetario prorrateado o cabecera de factura. */
export function subtotalUsdLineaCompra(row: FilaMontoLineaCompra): number | null {
  if (row.esLinea && row.subtotalUsdLinea !== undefined) {
    return row.subtotalUsdLinea;
  }
  if (!row.esLinea) return row.montoUsd ?? null;
  const bs = subtotalBsLineaCompra(row);
  const moneda = normalizarMonedaExtracted(row.monedaOriginal);
  if (moneda === 'USD') {
    return Math.round(subtotalNominalLineaCompra(row) * 100) / 100;
  }
  const directo = vesAUsdConTasa(bs, row.tasaBcv);
  if (directo != null) return directo;
  if (row.montoUsd != null && row.montoBs > 0) {
    return Math.round(((bs / row.montoBs) * row.montoUsd) * 100) / 100;
  }
  return null;
}
