/**
 * Estados que solo puede poner el recálculo de abonos (no un UPDATE libre).
 */
export const ESTADOS_COBRO_SOLO_ABONOS = ['cobrado', 'parcialmente_pagado', 'pagado'] as const;

export type EstadoCobroSoloAbonos = (typeof ESTADOS_COBRO_SOLO_ABONOS)[number];

export const ESTADOS_LIBRES_PRESUPUESTO = ['no_enviado', 'enviado', 'aprobado', 'no_aprobado'] as const;

export function esEstadoCobroSoloAbonos(status: string | null | undefined): boolean {
  return (ESTADOS_COBRO_SOLO_ABONOS as readonly string[]).includes(String(status ?? '').trim());
}

export function puedeCambiarStatusLibre(status: string | null | undefined): boolean {
  return (ESTADOS_LIBRES_PRESUPUESTO as readonly string[]).includes(String(status ?? '').trim());
}

export const AVISO_STATUS_SOLO_ABONOS =
  'Los estados Por pagar y Pagado se actualizan al registrar abonos. No se pueden marcar a mano.';
