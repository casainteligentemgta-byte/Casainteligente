/**
 * Compila el horario semanal del contrato express a un párrafo en español
 * (fragmento tras «40 horas de trabajo efectivo:» en la cláusula CUARTA del PDF).
 */

export type DiaLaboralKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const ORDEN: DiaLaboralKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const NOMBRE: Record<DiaLaboralKey, string> = {
  mon: 'lunes',
  tue: 'martes',
  wed: 'miércoles',
  thu: 'jueves',
  fri: 'viernes',
  sat: 'sábado',
  sun: 'domingo',
};

export type HorarioSemanalExpressState = {
  dias: Record<DiaLaboralKey, boolean>;
  /** Si es true y el viernes está marcado, el viernes usa `viernesEntrada`/`viernesSalida`. */
  viernesDistinto: boolean;
  /** HH:mm (24 h) */
  horaEntrada: string;
  horaSalida: string;
  usaDescanso: boolean;
  descansoInicio: string;
  descansoFin: string;
  viernesEntrada: string;
  viernesSalida: string;
};

export function estadoHorarioExpressPorDefecto(): HorarioSemanalExpressState {
  return {
    dias: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    viernesDistinto: true,
    horaEntrada: '07:00',
    horaSalida: '17:00',
    usaDescanso: true,
    descansoInicio: '12:00',
    descansoFin: '13:00',
    viernesEntrada: '07:00',
    viernesSalida: '12:00',
  };
}

/** Convierte "07:00" a "7:00 a.m." (es-VE). */
export function formatearHoraEsVe(hhmm: string): string {
  const t = (hhmm ?? '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return t || '—';
  const [hRaw, mRaw] = t.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  const d = new Date(2000, 0, 1, h, m, 0, 0);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function listaDiasEspanol(keys: DiaLaboralKey[]): string {
  const labels = keys.map((k) => NOMBRE[k]);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

function fraseBloque(
  dias: DiaLaboralKey[],
  entrada: string,
  salida: string,
  usaDescanso: boolean,
  dIn: string,
  dFin: string,
): string {
  if (dias.length === 0) return '';
  const de = formatearHoraEsVe(entrada);
  const a = formatearHoraEsVe(salida);
  const lista = listaDiasEspanol(dias);
  const tit = lista ? `${lista.charAt(0).toUpperCase()}${lista.slice(1)}` : '';
  let s = `${tit}, de ${de} a ${a}`;
  if (usaDescanso && dIn && dFin) {
    s += ` (1 hora de descanso de ${formatearHoraEsVe(dIn)} a ${formatearHoraEsVe(dFin)}, no imputable a la jornada)`;
  }
  s += '.';
  return s;
}

/**
 * Devuelve el texto del detalle de horario (sin el prefijo de «40 horas»).
 */
export function compilarHorarioSemanalExpress(s: HorarioSemanalExpressState): string {
  const activos = ORDEN.filter((k) => s.dias[k]);
  if (activos.length === 0) return '';

  if (s.viernesDistinto && s.dias.fri) {
    const sinViernes = activos.filter((k) => k !== 'fri');
    const partes: string[] = [];
    if (sinViernes.length) {
      partes.push(
        fraseBloque(sinViernes, s.horaEntrada, s.horaSalida, s.usaDescanso, s.descansoInicio, s.descansoFin),
      );
    }
    const deV = formatearHoraEsVe(s.viernesEntrada);
    const aV = formatearHoraEsVe(s.viernesSalida);
    partes.push(`Los viernes, de ${deV} a ${aV} (jornada continua).`);
    return partes.filter(Boolean).join(' ');
  }

  return fraseBloque(activos, s.horaEntrada, s.horaSalida, s.usaDescanso, s.descansoInicio, s.descansoFin);
}
