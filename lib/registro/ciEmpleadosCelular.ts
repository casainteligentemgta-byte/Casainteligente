/** Placeholder cuando el expediente se crea sin WhatsApp (enlace de examen, express). */
export const CELULAR_PENDIENTE_RRHH = 'Pendiente RRHH';

/** Valor seguro para INSERT/UPDATE si `celular` es NOT NULL en el entorno. */
export function celularParaInserto(telefono?: string | null, whatsapp?: string | null): string {
  const t = (telefono ?? whatsapp ?? '').trim();
  return t || CELULAR_PENDIENTE_RRHH;
}
