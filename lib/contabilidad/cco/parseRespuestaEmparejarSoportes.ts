/**
 * Parseo defensivo de /api/contabilidad/cco/emparejar-soportes.
 * Safari lanza "The string did not match the expected pattern" al hacer
 * response.json() sobre HTML de timeout/502 de Vercel.
 */

export type RespuestaEmparejarSoportes = {
  ok?: boolean;
  error?: string;
  matches?: unknown[];
  resumen?: { auto: number; duda: number; sin_match: number };
  modelHint?: string;
};

const MSG_TIMEOUT =
  'El servidor no terminó a tiempo (PDF grande o muchas páginas). Suba un PDF más corto, por facturas sueltas, o filtre egresos antes de emparejar.';

const MSG_PARSE =
  'No se pudo leer la respuesta del agente. Suele ocurrir con PDFs multipágina pesados o cortes de red. Pruebe con menos páginas o Chrome.';

/** Traduce errores crípticos (Safari / JSON) a mensaje accionable. */
export function mensajeErrorEmparejarSoportes(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error del agente';

  if (/did not match the expected pattern/i.test(raw) || /JSON Parse error/i.test(raw)) {
    return MSG_PARSE;
  }
  if (/unexpected token/i.test(raw) || /is not valid JSON/i.test(raw)) {
    return MSG_PARSE;
  }
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(raw)) {
    return 'No hubo conexión con el servidor. Revise la red e intente de nuevo.';
  }
  return raw || 'Error del agente';
}

/**
 * Interpreta el cuerpo de la respuesta (texto) sin romper en Safari
 * cuando Vercel devuelve HTML o cuerpo truncado.
 */
export function parseRespuestaEmparejarSoportes(
  raw: string,
  status: number,
): RespuestaEmparejarSoportes {
  const t = (raw ?? '').trim();

  if (!t) {
    throw new Error(
      status === 413 || status === 502 || status === 504
        ? `El servidor cortó la carga (HTTP ${status}). ${MSG_TIMEOUT}`
        : `Respuesta vacía del servidor (HTTP ${status}). ${MSG_TIMEOUT}`,
    );
  }

  if (/^<!DOCTYPE|^<html/i.test(t) || (status >= 500 && !t.startsWith('{') && !t.startsWith('['))) {
    throw new Error(MSG_TIMEOUT);
  }

  const tryParse = (s: string) => JSON.parse(s) as RespuestaEmparejarSoportes;

  try {
    return tryParse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return tryParse(t.slice(start, end + 1));
      } catch {
        /* fallthrough */
      }
    }
    throw new Error(
      status >= 500
        ? MSG_TIMEOUT
        : `No se pudo leer la respuesta (HTTP ${status}). ${MSG_PARSE}`,
    );
  }
}
