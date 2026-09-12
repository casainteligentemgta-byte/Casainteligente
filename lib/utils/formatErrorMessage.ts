/** Convierte errores API, PostgREST o objetos sueltos a texto legible (evita "[object Object]"). */

function esMensajeInutil(value: string): boolean {
  const t = value.trim();
  return !t || t === '[object Object]' || t === 'Error: [object Object]';
}

function camposPostgrest(o: Record<string, unknown>): string | null {
  const message =
    typeof o.message === 'string'
      ? o.message.trim()
      : typeof o.message === 'object' && o.message
        ? formatErrorMessage(o.message)
        : '';
  const details = typeof o.details === 'string' ? o.details.trim() : '';
  const hint = typeof o.hint === 'string' ? o.hint.trim() : '';
  const code = typeof o.code === 'string' || typeof o.code === 'number' ? String(o.code).trim() : '';
  const parts = [message, details, hint].filter((p) => p && !esMensajeInutil(p));
  if (code && !parts.some((p) => p.includes(code))) parts.push(`[${code}]`);
  return parts.length > 0 ? parts.join(' — ') : null;
}

export function formatErrorMessage(err: unknown): string {
  if (err == null) return 'Error desconocido';
  if (typeof err === 'string') {
    return esMensajeInutil(err) ? 'Error desconocido' : err.trim();
  }
  if (typeof err === 'number' || typeof err === 'boolean') return String(err);

  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (msg && !esMensajeInutil(msg)) return msg;
    if (err.cause != null && err.cause !== err) {
      const nested = formatErrorMessage(err.cause);
      if (nested !== 'Error desconocido') return nested;
    }
    return err.name && err.name !== 'Error' ? err.name : 'Error desconocido';
  }

  if (Array.isArray(err)) {
    const parts = err.map((item) => formatErrorMessage(item)).filter((p) => p && p !== 'Error desconocido');
    return parts.length > 0 ? parts.join(' · ') : 'Error desconocido';
  }

  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;

    if (typeof o.error !== 'undefined' && o.error !== err) {
      if (!(typeof o.error === 'string' && esMensajeInutil(o.error))) {
        const nested = formatErrorMessage(o.error);
        if (nested !== 'Error desconocido') return nested;
      }
    }

    const postgrest = camposPostgrest(o);
    if (postgrest) return postgrest;

    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}' && json !== '[]' && json !== 'null' && !json.includes('[object Object]')) {
        return json;
      }
    } catch {
      /* circular */
    }
  }

  return 'Error desconocido';
}

/** Extrae mensaje de cuerpo JSON de API (`error`, `hint`, `message`). */
export function formatApiErrorBody(data: unknown, fallback = 'Error en la operación'): string {
  if (data == null) return fallback;
  if (typeof data === 'string') {
    return esMensajeInutil(data) ? fallback : data.trim();
  }

  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (o.error != null) {
      const fromError = formatErrorMessage(o.error);
      if (fromError !== 'Error desconocido') return fromError;
    }
    if (typeof o.hint === 'string' && o.hint.trim() && !esMensajeInutil(o.hint)) return o.hint.trim();
    if (typeof o.message === 'string' && o.message.trim() && !esMensajeInutil(o.message)) {
      return o.message.trim();
    }
  }

  const formatted = formatErrorMessage(data);
  return formatted !== 'Error desconocido' ? formatted : fallback;
}
