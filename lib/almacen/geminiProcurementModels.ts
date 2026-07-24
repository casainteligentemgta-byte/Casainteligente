/** Modelo por defecto para OCR de facturas (cuota free tier distinta a gemini-2.0-flash). */
export const GEMINI_PROCUREMENT_DEFAULT_MODEL = 'gemini-2.5-flash';

/** Orden de intentos si el modelo anterior falla por cuota o sobrecarga. */
export const GEMINI_PROCUREMENT_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.0-flash',
] as const;

export function procurementModelCandidates(): string[] {
  const preferred = process.env.GEMINI_PROCUREMENT_MODEL?.trim();
  const list = preferred
    ? [preferred, ...GEMINI_PROCUREMENT_FALLBACK_MODELS.filter((m) => m !== preferred)]
    : [...GEMINI_PROCUREMENT_FALLBACK_MODELS];
  return Array.from(new Set(list));
}
