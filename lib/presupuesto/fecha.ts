/** Fecha de documento del presupuesto (día en Venezuela, independiente de `created_at`). */

const TZ_VE = 'America/Caracas';

export function esFechaIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** YYYY-MM-DD del instante dado, en zona America/Caracas. */
export function hoyFechaPresupuesto(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_VE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Extrae YYYY-MM-DD de `budgets.fecha` (date) o `created_at` (timestamptz).
 * Las fechas de calendario se toman tal cual; los timestamps se convierten a Caracas.
 */
export function isoAFechaInput(iso: string | null | undefined, now = new Date()): string {
  if (!iso || typeof iso !== 'string') return hoyFechaPresupuesto(now);
  const trimmed = iso.trim();
  if (esFechaIso(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return hoyFechaPresupuesto(now);
  return hoyFechaPresupuesto(d);
}

/** Interpreta YYYY-MM-DD como fecha local (evita el desfase UTC de `new Date('YYYY-MM-DD')`). */
export function fechaADateLocal(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) {
    const d = new Date(isoDate);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatFechaPresupuestoLarga(isoDate: string | null | undefined, now = new Date()): string {
  const src = isoDate && String(isoDate).trim() ? String(isoDate) : hoyFechaPresupuesto(now);
  const d = fechaADateLocal(esFechaIso(src) ? src : isoAFechaInput(src, now));
  if (!d) return '';
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatFechaPresupuestoCorta(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const raw = String(isoDate);
  const d = fechaADateLocal(esFechaIso(raw) ? raw : isoAFechaInput(raw));
  if (!d) return '—';
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

export function fechaDocumentoDeBudget(row: { fecha?: unknown; created_at?: unknown }): string {
  const fecha = typeof row.fecha === 'string' ? row.fecha : null;
  const created = typeof row.created_at === 'string' ? row.created_at : null;
  return isoAFechaInput(fecha || created);
}

/** Si la migración 312 aún no está aplicada, PostgREST rechaza la columna `fecha`. */
export function esErrorColumnaFecha(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('fecha') && (m.includes('column') || m.includes('schema') || m.includes('could not find'));
}

/** Mediodía en Caracas para no correr el día al guardar en `created_at` (fallback). */
export function fechaACreatedAtMediodiaCaracas(fecha: string): string {
  return `${fecha}T12:00:00-04:00`;
}
