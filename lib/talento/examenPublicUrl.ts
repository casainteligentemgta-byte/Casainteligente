/**
 * Ruta pública del examen según rol: obreros usan segmento dinámico (mejor para móvil / QR).
 */
export function rutaExamenTalentoPublica(token: string, rolExamen?: string | null): string {
  const enc = encodeURIComponent(token);
  if (rolExamen === 'obrero') return `/talento/examen/${enc}`;
  return `/talento/examen?token=${enc}`;
}
