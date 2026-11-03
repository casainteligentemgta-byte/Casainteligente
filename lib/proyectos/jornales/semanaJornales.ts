import { lunesDeSemanaIso, domingoDeSemanaIso } from '@/lib/nomina/semanaIsoNomina';

const TZ_VE = 'America/Caracas';

/** Fecha civil de Venezuela (YYYY-MM-DD). */
export function hoyIsoCaracas(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: TZ_VE });
}

export function lunesDeSemanaJornales(iso: string): string {
  return lunesDeSemanaIso(iso);
}

export function domingoDeSemanaJornales(lunesIso: string): string {
  return domingoDeSemanaIso(lunesIso);
}

/** Siete fechas ISO lun–dom a partir del lunes. */
export function fechasDeSemana(lunesIso: string): string[] {
  const lunes = lunesDeSemanaIso(lunesIso);
  const [y, mo, d] = lunes.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const dt = new Date(Date.UTC(y, mo - 1, d + i));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

export function sumarDiasIso(iso: string, dias: number): string {
  const [y, mo, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

export function etiquetaSemanaVe(lunesIso: string, domingoIso: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return dt.toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };
  return `${fmt(lunesIso)} – ${fmt(domingoIso)}`;
}
