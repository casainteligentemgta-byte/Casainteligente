export type PrefijoCedulaVE = 'V' | 'E';

/** Formato cédula venezolana: V-12345678 o E-12345678 (solo dígitos en número). */
export function formatDocumentoCedulaVE(prefijo: PrefijoCedulaVE, numero: string): string {
  const digits = numero.replace(/\D/g, '');
  if (!digits) return '';
  return `${prefijo}-${digits}`;
}

/**
 * Interpreta cédula/documento almacenado (V123…, V-123…, E-…) para controles del examen.
 */
export function parseDocumentoCedulaVE(raw: string | null | undefined): { prefijo: PrefijoCedulaVE; numero: string } | null {
  const s = (raw ?? '').replace(/\uFEFF/g, '').trim().toUpperCase();
  if (!s) return null;
  const cleaned = s.replace(/\s+/g, '');
  let prefijo: PrefijoCedulaVE = 'V';
  let body = cleaned;
  if (cleaned.startsWith('V') || cleaned.startsWith('E')) {
    prefijo = cleaned[0] as PrefijoCedulaVE;
    body = cleaned.slice(1);
  }
  body = body.replace(/^[-/]+/, '');
  const digits = body.replace(/\D/g, '');
  if (!digits) return null;
  return { prefijo, numero: digits.slice(0, 12) };
}
