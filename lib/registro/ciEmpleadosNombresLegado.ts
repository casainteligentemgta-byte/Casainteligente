/**
 * Algunas instalaciones de `ci_empleados` tienen la columna legado `nombres` NOT NULL.
 * Rellenamos desde nombres de pila; si faltan, desde `nombre_completo` (formato "Apellidos, Nombres" o texto libre).
 */
export function nombresLegadoDesdeGaceta(
  parts: { primerNombre: string; segundoNombre: string },
  nombreCompletoReserva?: string,
): string {
  const s = `${parts.primerNombre.trim()} ${parts.segundoNombre.trim()}`.replace(/\s+/g, ' ').trim();
  if (s) return s.slice(0, 500);
  const full = (nombreCompletoReserva ?? '').trim();
  if (full) {
    const comma = full.indexOf(',');
    if (comma >= 0) {
      const after = full.slice(comma + 1).trim();
      if (after) return after.slice(0, 500);
    }
    const words = full.split(/\s+/).filter(Boolean);
    if (words.length) return words.slice(0, 4).join(' ').slice(0, 500);
  }
  return 'Postulante';
}

/** Cuando solo hay un nombre completo (examen / invitación). */
export function nombresLegadoDesdeTextoLibre(nombre: string, fallback = 'Candidato'): string {
  const s = nombre.trim();
  return (s || fallback).slice(0, 500);
}
