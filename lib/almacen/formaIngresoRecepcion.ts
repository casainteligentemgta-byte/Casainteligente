/** Forma de ingreso por línea FRM (auditoría / conciliación posterior). */
export type FormaIngresoRecepcion =
  | 'con_factura'
  | 'con_nota'
  | 'sin_nota'
  | 'pendiente_factura';

export const FORMAS_INGRESO_RECEPCION: FormaIngresoRecepcion[] = [
  'con_factura',
  'con_nota',
  'sin_nota',
  'pendiente_factura',
];

export const ETIQUETA_FORMA_INGRESO: Record<FormaIngresoRecepcion, string> = {
  con_factura: 'Con factura',
  con_nota: 'Con nota de entrega',
  sin_nota: 'Sin nota',
  pendiente_factura: 'Factura pendiente',
};

export function esFormaIngresoRecepcion(v: string): v is FormaIngresoRecepcion {
  return (FORMAS_INGRESO_RECEPCION as string[]).includes(v);
}

/** Valor por defecto según pestaña / flujo Telegram. */
export function formaIngresoDefaultDesdeVista(
  vista: 'ingreso_manual' | 'nota_entrega' | 'emergencia',
): FormaIngresoRecepcion {
  if (vista === 'nota_entrega') return 'con_nota';
  return 'sin_nota';
}

export function formaIngresoDefaultDesdeFlujoTelegram(flujo: string | undefined): FormaIngresoRecepcion {
  if (flujo === 'nota_entrega_ingreso') return 'con_nota';
  if (flujo === 'emergencia_ingreso') return 'sin_nota';
  return 'sin_nota';
}
