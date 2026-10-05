/**
 * Moneda de NetVision. Los precios del catálogo están en dólares; para verlos
 * en bolívares (o euros) hace falta la tasa de cambio. Sin tasa, los montos se
 * muestran en dólares: nunca se pinta un precio en dólares con el símbolo «Bs».
 */
import type { NetVisionCurrency } from '@/lib/netvision/types'

const TASA_MAX = 10_000_000

/** Tasa válida (unidades de la moneda por 1 USD) o null. */
export function normalizarTasa(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor.replace(',', '.')) : NaN
  if (!Number.isFinite(n) || n <= 0 || n > TASA_MAX) return null
  return Math.round(n * 10000) / 10000
}

/** Moneda en que de verdad se muestran los montos: la elegida solo si hay tasa. */
export function monedaEfectiva(currency: NetVisionCurrency, tasa: unknown): NetVisionCurrency {
  if (currency === 'USD') return 'USD'
  return normalizarTasa(tasa) != null ? currency : 'USD'
}

/** ¿Se eligió otra moneda pero falta la tasa? */
export function faltaTasa(currency: NetVisionCurrency, tasa: unknown): boolean {
  return currency !== 'USD' && normalizarTasa(tasa) == null
}

/** Convierte un monto en dólares a la moneda efectiva. */
export function convertirUsd(usd: number, currency: NetVisionCurrency, tasa: unknown): number {
  const t = normalizarTasa(tasa)
  if (currency === 'USD' || t == null) return usd
  return usd * t
}

export function simboloMoneda(currency: NetVisionCurrency): string {
  if (currency === 'EUR') return '€'
  if (currency === 'VES') return 'Bs'
  return '$'
}

/** Nombre de la tasa para la moneda elegida, p. ej. «Bs por $». */
export function etiquetaTasa(currency: NetVisionCurrency): string {
  return `${simboloMoneda(currency)} por $`
}

const conMiles = (n: number, decimales: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

/**
 * Monto en dólares → texto en la moneda efectiva: «$1,250.00», «Bs 456,250.00».
 * Sin tasa para la moneda elegida, queda en dólares.
 */
export function formatoMonto(
  usd: number,
  currency: NetVisionCurrency,
  tasa: unknown,
  decimales = 2,
): string {
  const efectiva = monedaEfectiva(currency, tasa)
  // Se convierte el monto en dólares ya redondeado a centavos: así cuadra con
  // «equivale en dólares» y con una calculadora.
  const centavos = Math.round((Number.isFinite(usd) ? usd : 0) * 100) / 100
  const valor = convertirUsd(centavos, efectiva, tasa)
  const sym = simboloMoneda(efectiva)
  return efectiva === 'USD' ? `${sym}${conMiles(valor, decimales)}` : `${sym} ${conMiles(valor, decimales)}`
}
