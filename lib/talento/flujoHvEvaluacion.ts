/**
 * Tras la hoja de vida: una sola evaluación unificada (color + ABC).
 * Mismo token / empleado; no se crean dos expedientes.
 *
 * Rutas antiguas `/talento/evaluacion-color` y `/talento/evaluacion-obrero`
 * redirigen a `/talento/evaluacion`.
 */

export function urlOnboardingHv(token: string, baseUrl = ''): string {
  const base = baseUrl.replace(/\/$/, '');
  const path = `/reclutamiento/onboarding/${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

/** Evaluación única de ingreso (color + lógica + honestidad + ABC). */
export function urlEvaluacionUnificada(token: string, baseUrl = ''): string {
  const base = baseUrl.replace(/\/$/, '');
  const path = `/talento/evaluacion?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

/** @deprecated Usar urlEvaluacionUnificada */
export function urlEvaluacionColor(token: string, baseUrl = ''): string {
  return urlEvaluacionUnificada(token, baseUrl);
}

/** @deprecated Usar urlEvaluacionUnificada */
export function urlEvaluacionObreroAbc(token: string, baseUrl = ''): string {
  return urlEvaluacionUnificada(token, baseUrl);
}

/** Primera (y única) evaluación después de completar la HV. */
export function urlSiguientePostHv(token: string, baseUrl = ''): string {
  return urlEvaluacionUnificada(token, baseUrl);
}

/** @deprecated Ya no hay segunda evaluación; misma URL unificada. */
export function urlSiguientePostColor(token: string, baseUrl = ''): string {
  return urlEvaluacionUnificada(token, baseUrl);
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
    `En un solo enlace completa tu hoja de vida${cargoTxt} y luego una evaluación corta ` +
    `(unas 21 preguntas). Enlace:\n${opts.link}`
  );
}

/** Texto breve para WhatsApp / SMS al candidato tras HV. */
export function mensajeWhatsAppPostHv(token: string, baseUrl = ''): string {
  const url = urlSiguientePostHv(token, baseUrl);
  return (
    `Casa Inteligente — gracias por completar tu hoja de vida.\n\n` +
    `Siguiente paso: una evaluación corta (unos 15–20 minutos, ~21 preguntas).\n` +
    `Al terminar verás confirmación de registro; el detalle queda para RRHH.\n\n` +
    `${url}`
  );
}
