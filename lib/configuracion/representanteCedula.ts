/**
 * Nacionalidad e identidad del representante a partir de la cédula (V/E).
 */

/** Letra de documento: V = venezolano, E = extranjero. */
export function letraCedula(cedula: string): 'V' | 'E' | null {
  const t = (cedula ?? '').trim().toUpperCase();
  const m = t.match(/^([VE])/);
  if (!m) return null;
  return m[1] as 'V' | 'E';
}

export function esCedulaVenezolana(cedula: string): boolean {
  return letraCedula(cedula) === 'V';
}

/**
 * Nacionalidad para contrato/registro desde la cédula.
 * V → Venezolano; E u otra → null (el formulario pide texto).
 */
export function nacionalidadDesdeCedula(cedula: string): 'Venezolano' | null {
  return esCedulaVenezolana(cedula) ? 'Venezolano' : null;
}

/** Edad en años cumplidos desde ISO `YYYY-MM-DD` (o vacío). */
export function edadDesdeFechaNacimiento(fechaIso: string, hoy = new Date()): string {
  const t = (fechaIso ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
  const [ys, ms, ds] = t.split('-').map((x) => Number(x));
  if (!ys || !ms || !ds) return '';
  const born = new Date(ys, ms - 1, ds);
  if (Number.isNaN(born.getTime())) return '';
  let age = hoy.getFullYear() - born.getFullYear();
  const m = hoy.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < born.getDate())) age -= 1;
  if (age < 0 || age > 130) return '';
  return String(age);
}
