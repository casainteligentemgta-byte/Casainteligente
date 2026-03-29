export type PrefijoCedulaVE = 'V' | 'E';

/** Formato cédula venezolana: V-12345678 o E-12345678 (solo dígitos en número). */
export function formatDocumentoCedulaVE(prefijo: PrefijoCedulaVE, numero: string): string {
  const digits = numero.replace(/\D/g, '');
  if (!digits) return '';
  return `${prefijo}-${digits}`;
}
