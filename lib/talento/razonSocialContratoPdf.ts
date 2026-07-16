/**
 * Detecta si la denominación ya incluye un tipo societario habitual (no se añade sufijo por defecto).
 */
function tieneSufijoSocietarioExplicito(denominacion: string): boolean {
  const t = denominacion.trim();
  if (!t) return false;
  if (/\bcompa(ñ|n)ía\s+anónima\b/i.test(t)) return true;
  // Tras coma o como palabra final: C.A., S.A., S.R.L., R.L., C.S.
  return /(?:,\s*|\s+)(c\.?\s*a\.?|s\.?\s*a\.?|s\.?\s*r\.?\s*l\.?|r\.?\s*l\.?|c\.?\s*s\.?)\s*$/i.test(t);
}

/**
 * Razón social para contratos (PDF / cláusulas): prioriza `nombre_legal`, si no `nombre`.
 * Si no trae tipo societario (p. ej. solo «CASA INTELIGENTE»), se añade «, C.A.» como en actas laborales venezolanas.
 */
export function razonSocialPatronoParaContratoPdf(
  nombreLegal: string | null | undefined,
  nombre: string | null | undefined,
): string {
  const base = (nombreLegal ?? '').trim() || (nombre ?? '').trim();
  if (!base) return '';
  if (tieneSufijoSocietarioExplicito(base)) return base;
  const sinCola = base.replace(/[,\s]+$/g, '').replace(/\.$/, '');
  return `${sinCola}, C.A.`;
}
