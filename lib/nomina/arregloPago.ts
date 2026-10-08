import {
  type ClasePagoObra,
  inferirClasePagoObra,
  round2,
  sobreUsdDeClase,
} from '@/lib/nomina/reglasPagoObra';

/**
 * Arreglo de pago del trabajador: lo que se pacta antes del contrato.
 *  - semanal: lo que recibe cada semana (USD como moneda de cuenta; se paga en bolívares).
 *  - mensual: el pago adicional cada cuatro semanas trabajadas.
 * Por defecto ambos montos son iguales y dependen de la clase (ayudante / clasificado).
 */
export type ArregloPago = { semanalUsd: number; mensualUsd: number };

/** Tope de cordura: un monto mayor casi siempre es un error de tecleo. */
export const ARREGLO_PAGO_MAX_USD = 2000;

/** Monto válido (> 0 y dentro del tope) o `null`. Acepta «115», «115,50» o número. */
export function montoArregloValido(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > ARREGLO_PAGO_MAX_USD) return null;
  return round2(n);
}

export function arregloPagoPorDefectoDeClase(clase: ClasePagoObra): ArregloPago {
  const usd = sobreUsdDeClase(clase);
  return { semanalUsd: usd, mensualUsd: usd };
}

export function arregloPagoPorDefecto(cargoCodigo?: string | null, cargoNombre?: string | null): ArregloPago {
  return arregloPagoPorDefectoDeClase(inferirClasePagoObra(cargoCodigo, cargoNombre));
}

/**
 * Arreglo efectivo: lo pactado si es válido; si no, el monto por defecto de la clase.
 * Si solo se indicó el semanal, el mensual lo sigue (regla: el mensual es igual al semanal).
 */
export function resolverArregloPago(args: {
  semanalUsd?: unknown;
  mensualUsd?: unknown;
  cargoCodigo?: string | null;
  cargoNombre?: string | null;
  clase?: ClasePagoObra | null;
}): ArregloPago {
  const base = args.clase
    ? arregloPagoPorDefectoDeClase(args.clase)
    : arregloPagoPorDefecto(args.cargoCodigo, args.cargoNombre);
  const semanal = montoArregloValido(args.semanalUsd);
  const mensual = montoArregloValido(args.mensualUsd);
  const semanalUsd = semanal ?? base.semanalUsd;
  return { semanalUsd, mensualUsd: mensual ?? semanal ?? base.mensualUsd };
}
