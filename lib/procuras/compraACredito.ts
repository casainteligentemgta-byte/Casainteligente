/**
 * Compra a crédito: el Contador informó que no hay fondos y aun así el PM aprobó.
 * La solicitud no se bloquea; la aprobación del PM vale como autorización de crédito.
 */

/** El Contador informó que no hay fondos disponibles para esta solicitud. */
export function procuraSinFondos(
  row: { viabilidad_presupuestaria?: string | null } | null | undefined,
): boolean {
  return String(row?.viabilidad_presupuestaria ?? '').trim().toLowerCase() === 'no';
}

export const AVISO_PM_SIN_FONDOS =
  '⚠️ <b>Sin fondos disponibles.</b> Si aprueba, autoriza que la compra se haga <b>a crédito</b>.';

export const LINEA_COMPRA_A_CREDITO =
  '💳 <b>Compra a crédito</b> — aprobada por el PM sin fondos disponibles.';

export const AVISO_FACTURA_A_CREDITO =
  '💳 <b>Compra aprobada a crédito</b> (sin fondos disponibles): la factura se registra a crédito.';
