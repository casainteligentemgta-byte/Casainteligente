import type { HojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';

/** Normaliza documento para comparación (espacios, puntos, guiones, mayúsculas). */
export function normCedulaToken(s: string): string {
  return String(s ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, '')
    .replace(/[.\u00B7\-]/g, '')
    .toUpperCase();
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
