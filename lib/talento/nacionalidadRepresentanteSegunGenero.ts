/**
 * Ajusta nacionalidad del representante legal al género (Sra. → venezolana).
 */
export function nacionalidadRepresentanteSegunGenero(
  raw: string | null | undefined,
  femenino: boolean,
): string {
  const t = String(raw ?? '').trim();
  if (!t) return femenino ? 'venezolana' : 'venezolano';

  const lower = t.toLowerCase();

  // Ya correcto
  if (femenino && (lower === 'venezolana' || lower === 'extranjera')) return t;
  if (!femenino && (lower === 'venezolano' || lower === 'extranjero')) return t;

  // Formas ambiguas o en masculino/femenino invertido
  if (/^venezolan[oa]s?$/i.test(t) || /^venezolano\(a\)$/i.test(t)) {
    return femenino ? 'venezolana' : 'venezolano';
  }
  if (/^extranjer[oa]s?$/i.test(t) || /^extranjero\(a\)$/i.test(t)) {
    return femenino ? 'extranjera' : 'extranjero';
  }

  return t;
}
