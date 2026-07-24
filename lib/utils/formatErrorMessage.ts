/** Convierte errores API, PostgREST o objetos sueltos a texto legible (evita "[object Object]"). */
export function formatErrorMessage(err: unknown): string {
  if (err == null) return 'Error desconocido';
  if (typeof err === 'string') return err.trim() || 'Error desconocido';
  if (typeof err === 'number' || typeof err === 'boolean') return String(err);

  if (err instanceof Error) {
    const msg = err.message?.trim();
    return msg || err.name || 'Error desconocido';
  }

  if (Array.isArray(err)) {
    const parts = err.map((item) => formatErrorMessage(item)).filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Error desconocido';
  }

  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;

    if (typeof o.error !== 'undefined' && o.error !== err) {
      const nested = formatErrorMessage(o.error);
      if (nested !== 'Error desconocido') return nested;
    }

    if (typeof o.message === 'string' && o.message.trim()) {
      const parts = [o.message.trim()];
      if (typeof o.details === 'string' && o.details.trim()) parts.push(o.details.trim());
      if (typeof o.hint === 'string' && o.hint.trim()) parts.push(o.hint.trim());
      if (typeof o.code === 'string' && o.code.trim()) parts.push(`[${o.code}]`);
      return parts.join(' — ');
    }

    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return json;
    } catch {
      /* circular */
    }
  }

  return String(err);
}

/** Extrae mensaje de cuerpo JSON de API (`error`, `hint`, `message`). */
export function formatApiErrorBody(data: unknown, fallback = 'Error en la operación'): string {
  if (data == null) return fallback;
  if (typeof data === 'string') return data.trim() || fallback;

  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (o.error != null) {
      const fromError = formatErrorMessage(o.error);
      if (fromError !== 'Error desconocido') return fromError;
    }
    if (typeof o.hint === 'string' && o.hint.trim()) return o.hint.trim();
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  }

  return formatErrorMessage(data) || fallback;
}
