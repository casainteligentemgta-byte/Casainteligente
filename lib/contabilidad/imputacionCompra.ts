export type ImputacionCompra = 'obra' | 'entidad';

export const IMPUTACION_OBRA: ImputacionCompra = 'obra';
export const IMPUTACION_ENTIDAD: ImputacionCompra = 'entidad';

export function parseImputacionCompra(v: unknown): ImputacionCompra {
  return String(v ?? '').trim().toLowerCase() === IMPUTACION_ENTIDAD
    ? IMPUTACION_ENTIDAD
    : IMPUTACION_OBRA;
}

export function esGastoEntidadImputacion(v: unknown): boolean {
  return parseImputacionCompra(v) === IMPUTACION_ENTIDAD;
}

export function etiquetaImputacionCompra(v: ImputacionCompra | string | null | undefined): string {
  return esGastoEntidadImputacion(v) ? 'Gasto entidad' : 'Obra';
}

/** Compras con imputación entidad no entran en ci_compras / valuación AD. */
export function compraCuentaEnValuacionDelegada(row: {
  imputacion?: string | null;
  proyecto_id?: string | null;
}): boolean {
  if (esGastoEntidadImputacion(row.imputacion)) return false;
  return Boolean(row.proyecto_id?.trim());
}
