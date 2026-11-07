/**
 * Días no hábiles del sistema bancario venezolano (SUDEBAN).
 *
 * El BCV no publica tasa los sábados, domingos ni feriados bancarios.
 * La lista es explícita por año para poder actualizarla cuando salga el
 * calendario oficial (circular SUDEBAN, art. 68 de la Ley de Instituciones
 * del Sector Bancario).
 *
 * 2026: fechas observadas del calendario SUDEBAN (traslados al lunes
 * cuando aplica; San José se celebra el jueves).
 * 2027: feriados nacionales LOTTT + feriados bancarios habituales
 * (Carnaval, Semana Santa, Reyes, etc.). Confirmar contra la circular
 * SUDEBAN 2027 cuando se publique.
 */

export type FeriadoBancarioVE = {
  fecha: string;
  nombre: string;
};

/** Calendario mantenible: agregar aquí cada nuevo año. */
export const FERIADOS_BANCARIOS_VE: readonly FeriadoBancarioVE[] = [
  // 2026 — circular SUDEBAN
  { fecha: '2026-01-01', nombre: 'Año Nuevo' },
  { fecha: '2026-01-12', nombre: 'Día de Reyes (trasladado)' },
  { fecha: '2026-01-19', nombre: 'Día de la Divina Pastora (trasladado)' },
  { fecha: '2026-02-16', nombre: 'Carnaval' },
  { fecha: '2026-02-17', nombre: 'Carnaval' },
  { fecha: '2026-03-19', nombre: 'Día de San José' },
  { fecha: '2026-04-02', nombre: 'Jueves Santo' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo' },
  { fecha: '2026-05-01', nombre: 'Día del Trabajador' },
  { fecha: '2026-05-18', nombre: 'Ascensión del Señor (trasladado)' },
  { fecha: '2026-06-08', nombre: 'Corpus Christi (trasladado)' },
  { fecha: '2026-06-24', nombre: 'Batalla de Carabobo' },
  { fecha: '2026-06-29', nombre: 'San Pedro y San Pablo' },
  { fecha: '2026-07-24', nombre: 'Natalicio del Libertador' },
  { fecha: '2026-09-14', nombre: 'Virgen de Coromoto (trasladado)' },
  { fecha: '2026-10-12', nombre: 'Día de la Resistencia Indígena' },
  { fecha: '2026-10-26', nombre: 'San José Gregorio Hernández' },
  { fecha: '2026-11-23', nombre: 'Virgen del Rosario de Chiquinquirá (trasladado)' },
  { fecha: '2026-12-14', nombre: 'Inmaculada Concepción (trasladado)' },
  { fecha: '2026-12-24', nombre: 'Nochebuena' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
  { fecha: '2026-12-31', nombre: 'Fin de Año' },

  // 2027 — LOTTT + feriados bancarios habituales (confirmar circular SUDEBAN)
  { fecha: '2027-01-01', nombre: 'Año Nuevo' },
  { fecha: '2027-01-06', nombre: 'Día de Reyes' },
  { fecha: '2027-01-14', nombre: 'Día de la Divina Pastora' },
  { fecha: '2027-02-08', nombre: 'Carnaval' },
  { fecha: '2027-02-09', nombre: 'Carnaval' },
  { fecha: '2027-03-19', nombre: 'Día de San José' },
  { fecha: '2027-03-25', nombre: 'Jueves Santo' },
  { fecha: '2027-03-26', nombre: 'Viernes Santo' },
  { fecha: '2027-04-19', nombre: 'Declaración de la Independencia' },
  { fecha: '2027-05-01', nombre: 'Día del Trabajador' },
  { fecha: '2027-05-06', nombre: 'Ascensión del Señor' },
  { fecha: '2027-05-27', nombre: 'Corpus Christi' },
  { fecha: '2027-06-24', nombre: 'Batalla de Carabobo' },
  { fecha: '2027-06-29', nombre: 'San Pedro y San Pablo' },
  { fecha: '2027-07-05', nombre: 'Día de la Independencia' },
  { fecha: '2027-07-24', nombre: 'Natalicio del Libertador' },
  { fecha: '2027-10-12', nombre: 'Día de la Resistencia Indígena' },
  { fecha: '2027-10-25', nombre: 'San José Gregorio Hernández' },
  { fecha: '2027-11-01', nombre: 'Día de Todos los Santos' },
  { fecha: '2027-11-22', nombre: 'Virgen del Rosario de Chiquinquirá' },
  { fecha: '2027-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2027-12-24', nombre: 'Nochebuena' },
  { fecha: '2027-12-25', nombre: 'Navidad' },
  { fecha: '2027-12-31', nombre: 'Fin de Año' },
];

const FERIADOS_BANCARIOS_VE_SET = new Set(FERIADOS_BANCARIOS_VE.map((f) => f.fecha));

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function utcDesdeIso(iso: string): Date | null {
  const s = iso.trim().slice(0, 10);
  if (!ISO_FECHA.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

export function isoDesdeUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function esFeriadoBancarioVE(iso: string): boolean {
  return FERIADOS_BANCARIOS_VE_SET.has(iso.trim().slice(0, 10));
}

/** Sábado o domingo (UTC, fecha de calendario). */
export function esFinDeSemanaIso(iso: string): boolean {
  const d = utcDesdeIso(iso);
  if (!d) return false;
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

/** Lunes a viernes que no figura en el calendario bancario VE. */
export function esDiaHabilBancarioVE(iso: string): boolean {
  const s = iso.trim().slice(0, 10);
  if (!ISO_FECHA.test(s)) return false;
  return !esFinDeSemanaIso(s) && !esFeriadoBancarioVE(s);
}

/**
 * Hay al menos un día hábil bancario en (fechaDesde, fechaHasta].
 * Usado para saber si falta una publicación BCV entre la Fecha Valor y el día pedido.
 */
export function hayDiaHabilBancarioPosteriorA(fechaDesde: string, fechaHasta: string): boolean {
  const start = utcDesdeIso(fechaDesde);
  const end = utcDesdeIso(fechaHasta);
  if (!start || !end) return true;
  if (end.getTime() <= start.getTime()) return false;

  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard++ < 400) {
    if (esDiaHabilBancarioVE(isoDesdeUtc(cursor))) return true;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return false;
}
