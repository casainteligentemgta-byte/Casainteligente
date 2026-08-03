/**
 * Flujo unificado post–hoja de vida para obrero:
 * 1) Evaluación tipo de color (DISC) — no marca ci_examenes.usado_at
 * 2) Evaluación psicológica / ABC obrero — sí marca usado_at
 *
 * Un solo enlace público de entrada: onboarding HV; al terminar se encadena.
 */

export function urlOnboardingHv(token: string, baseUrl = ''): string {
  const base = baseUrl.replace(/\/$/, '');
  const path = `/reclutamiento/onboarding/${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

export function urlEvaluacionColor(token: string, baseUrl = ''): string {
  const base = baseUrl.replace(/\/$/, '');
  const path = `/talento/evaluacion-color?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

export function urlEvaluacionObreroAbc(token: string, baseUrl = ''): string {
  const base = baseUrl.replace(/\/$/, '');
  const path = `/talento/evaluacion-obrero?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

/** Primera evaluación después de completar la HV (obrero de campo). */
export function urlSiguientePostHv(token: string, baseUrl = ''): string {
  return urlEvaluacionColor(token, baseUrl);
}

/** Tras color → ABC / evaluación psicológica obrero. */
export function urlSiguientePostColor(token: string, baseUrl = ''): string {
  return urlEvaluacionObreroAbc(token, baseUrl);
}

export function mensajeWhatsAppHvYEvaluacion(opts: {
  nombre?: string;
  cargo?: string;
  link: string;
}): string {
  const nombre = (opts.nombre ?? '').trim();
  const cargo = (opts.cargo ?? '').trim();
  const saludo = nombre ? `¡Hola ${nombre}!` : '¡Hola!';
  const cargoTxt = cargo ? ` para el cargo de ${cargo}` : '';
  return (
    `${saludo} Te saluda el equipo de Reclutamiento de Casa Inteligente. ` +
    `En un solo enlace completa tu hoja de vida${cargoTxt} y luego tu evaluación ` +
    `(tipo de color y prueba de admisión). Enlace:\n${opts.link}`
  );
}
