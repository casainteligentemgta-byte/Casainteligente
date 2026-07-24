/**
 * Códigos de expediente Legal: EXP-YYYY-XXX (año America/Caracas, correlativo por org).
 */

const RE_CODIGO_EXP = /^EXP-(\d{4})-(\d+)$/;

export function yearCaracas(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
  }).format(date);
}

/** Formatea EXP-YYYY-XXX con al menos 3 dígitos en el correlativo. */
export function formatCodigoExpediente(year: string | number, seq: number): string {
  const y = String(year).slice(0, 4);
  const n = Math.max(1, Math.floor(seq));
  const pad = Math.max(3, String(n).length);
  return `EXP-${y}-${String(n).padStart(pad, '0')}`;
}

export function parseCodigoExpediente(
  codigo: string | null | undefined,
): { year: string; seq: number } | null {
  if (!codigo) return null;
  const m = RE_CODIGO_EXP.exec(codigo.trim());
  if (!m) return null;
  const seq = Number(m[2]);
  if (!Number.isFinite(seq) || seq < 1) return null;
  return { year: m[1]!, seq };
}

/**
 * Calcula el siguiente código a partir de una lista de códigos existentes
 * (fallback si el RPC `ci_legal_siguiente_codigo_expediente` no está disponible).
 */
export function siguienteCodigoExpedienteDesdeLista(
  codigos: Array<string | null | undefined>,
  year: string = yearCaracas(),
): string {
  let max = 0;
  for (const c of codigos) {
    const parsed = parseCodigoExpediente(c);
    if (!parsed || parsed.year !== year) continue;
    if (parsed.seq > max) max = parsed.seq;
  }
  return formatCodigoExpediente(year, max + 1);
}
