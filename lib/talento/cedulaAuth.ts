import type { HojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';

/** Normaliza documento para comparación (espacios, puntos, guiones, mayúsculas). */
export function normCedulaToken(s: string): string {
  return String(s ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, '')
    .replace(/[.\u00B7\-]/g, '')
    .toUpperCase();
}

/** Tras {@link normCedulaToken}: letra V o E y 6–9 dígitos (ej. `V12345678`). */
export const CEDULA_VE_NORMALIZADA_REGEX = /^[VE]\d{6,9}$/;

/**
 * Nacionalidad para contrato según prefijo de cédula.
 * V → venezolano/venezolana; E → extranjero/extranjera (según género).
 * Por defecto masculino (concuerda con «el ciudadano» / «Sr.»).
 * Sin letra reconocible → null.
 */
export function nacionalidadDesdeCedula(
  cedula: string | null | undefined,
  femenino = false,
): 'venezolana' | 'venezolano' | 'extranjera' | 'extranjero' | null {
  const t = normCedulaToken(cedula ?? '');
  if (t.startsWith('V')) return femenino ? 'venezolana' : 'venezolano';
  if (t.startsWith('E')) return femenino ? 'extranjera' : 'extranjero';
  return null;
}

/** Estado civil en contrato: si falta, «Soltero». */
export function estadoCivilContratoObrero(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim();
  return t || 'Soltero';
}

/**
 * True si el estado civil indica trabajadora (Soltera, Casada, etc.).
 * Vacío / Soltero / Casado → masculino (concuerda con «el ciudadano»).
 */
export function trabajadorFemeninoDesdeEstadoCivil(raw: string | null | undefined): boolean {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return false;
  return /^(soltera|casada|viuda|divorciada|separada)\b/.test(t);
}

/**
 * Número nacional sin prefijo (cédula VE: letra V/E opcional + dígitos).
 * Permite coincidir `V13848186` con `13848186` cuando el expediente y la URL difieren solo en el prefijo.
 */
export function cedulaDigitosCore(s: string): string {
  const t = normCedulaToken(s);
  const m = t.match(/^([VE])?(\d+)$/);
  if (m) return m[2] ?? '';
  return t.replace(/\D/g, '');
}

/** True si el documento de la URL corresponde al persistido (match estricto o mismo núcleo numérico). */
export function cedulaAuthCoincide(dbRaw: string, urlCedula: string): boolean {
  const a = normCedulaToken(dbRaw);
  const b = normCedulaToken(urlCedula);
  if (a && b && a === b) return true;
  const da = cedulaDigitosCore(dbRaw);
  const ub = cedulaDigitosCore(urlCedula);
  return da.length >= 6 && ub.length >= 6 && da === ub;
}

/** Cédula/documento efectivo: columnas `ci_empleados` o identificación dentro del JSON de hoja de vida. */
export function cedulaEfectivaDesdeEmpleado(
  row: Record<string, unknown>,
  hoja: HojaVidaObreroCompleta,
): string {
  const str = (k: string) => String(row[k] ?? '').trim();
  return str('cedula') || str('documento') || hoja.datosPersonales.cedulaIdentidad.trim();
}
