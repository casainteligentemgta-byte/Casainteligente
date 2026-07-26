/**
 * Interpreta respuestas fallidas de /api/pheme/procesar-audio (y afines).
 * Cuando Vercel rechaza el body (413) o hay timeout (504), el cuerpo suele ser HTML/vacío.
 */
export function parseProcesarAudioError(
  bodyText: string,
  status: number,
  parsed?: { detail?: string; error?: string; status?: string } | null,
): string {
  const fromJson =
    (parsed?.detail && String(parsed.detail).trim()) ||
    (parsed?.error && String(parsed.error).trim()) ||
    '';
  if (fromJson) return fromJson;

  if (status === 413) {
    return (
      'El audio supera el límite de carga del servidor (HTTP 413). ' +
      'Use la subida a Storage (automática en la app) o un archivo más liviano (máx. ~25 MB).'
    );
  }
  if (status === 504 || status === 524) {
    return (
      'El procesamiento del audio agotó el tiempo del servidor. ' +
      'Pruebe un audio más corto o reintente en unos minutos.'
    );
  }
  if (status === 502 || status === 503) {
    return (
      'El servicio no pudo completar la minuta (HTTP ' +
      status +
      '). Reintente; si persiste, revise GEMINI_API_KEY y las migraciones Pheme.'
    );
  }

  const lower = (bodyText || '').toLowerCase();
  if (
    lower.includes('payload too large') ||
    lower.includes('request entity too large') ||
    lower.includes('function_payload_too_large')
  ) {
    return (
      'El audio es demasiado grande para enviarlo directo al servidor. ' +
      'La app debe subirlo a Storage primero; recargue la página e intente de nuevo.'
    );
  }

  if (status >= 400) {
    return `No se pudo generar la minuta (HTTP ${status}).`;
  }
  return 'No se pudo generar la minuta';
}
