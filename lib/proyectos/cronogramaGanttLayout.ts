import type { CronogramaBarraEstado, CronogramaEscala, CronogramaTarea } from '@/types/cronograma';

export type TimelineColumn = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

export type BarraGanttLayout = {
  leftPct: number;
  widthPct: number;
  progressWidthPct: number;
  estado: CronogramaBarraEstado;
  avance: number;
};

const MS_DIA = 86_400_000;

export function parseFechaPlan(s: string): Date {
  const part = s.slice(0, 10);
  const [y, m, d] = part.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatFechaCorta(d: Date): string {
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
}

export function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(12, 0, 0, 0);
  return x;
}

export function inicioMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

export function addDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function diffDiasInclusive(inicio: Date, fin: Date): number {
  const a = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const b = Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate());
  return Math.max(1, Math.round((b - a) / MS_DIA) + 1);
}

export function rangoProyectoTareas(tareas: CronogramaTarea[]): { inicio: Date; fin: Date } {
  if (tareas.length === 0) {
    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    return { inicio: addDias(hoy, -7), fin: addDias(hoy, 28) };
  }
  let min = parseFechaPlan(tareas[0].fecha_inicio_planificada);
  let max = parseFechaPlan(tareas[0].fecha_fin_planificada);
  for (const t of tareas) {
    const a = parseFechaPlan(t.fecha_inicio_planificada);
    const b = parseFechaPlan(t.fecha_fin_planificada);
    if (a < min) min = a;
    if (b > max) max = b;
  }
  return {
    inicio: addDias(inicioSemana(min), -7),
    fin: addDias(inicioSemana(max), 21),
  };
}

export function buildTimelineColumns(
  inicio: Date,
  fin: Date,
  escala: CronogramaEscala,
): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  if (escala === 'mes') {
    let cursor = inicioMes(inicio);
    const end = inicioMes(fin);
    end.setMonth(end.getMonth() + 1);
    while (cursor < end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12, 0, 0, 0);
      const label = cursor.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' });
      cols.push({
        key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
        label,
        start: cursor,
        end: addDias(next, -1),
      });
      cursor = next;
    }
    return cols;
  }

  let cursor = inicioSemana(inicio);
  const limite = addDias(inicioSemana(fin), 7);
  while (cursor < limite) {
    const end = addDias(cursor, 6);
    cols.push({
      key: cursor.toISOString().slice(0, 10),
      label: `S ${formatFechaCorta(cursor)}`,
      start: cursor,
      end,
    });
    cursor = addDias(cursor, 7);
  }
  return cols;
}

function avanceEsperadoLineal(inicio: Date, fin: Date, hoy: Date): number {
  if (hoy <= inicio) return 0;
  if (hoy >= fin) return 100;
  const total = diffDiasInclusive(inicio, fin);
  const transcurrido = diffDiasInclusive(inicio, hoy);
  return Math.min(100, Math.max(0, (transcurrido / total) * 100));
}

export function estadoBarraGantt(
  avance: number,
  inicio: Date,
  fin: Date,
  hoy: Date,
): CronogramaBarraEstado {
  const pct = Math.min(100, Math.max(0, avance));
  if (pct >= 100) return 'completada';
  const esperado = avanceEsperadoLineal(inicio, fin, hoy);
  if (hoy > fin && pct < 100) return 'atrasada';
  if (pct + 8 < esperado) return 'en_riesgo';
  return 'a_tiempo';
}

export function calcularBarraGantt(
  tarea: CronogramaTarea,
  timelineInicio: Date,
  timelineFin: Date,
  hoy: Date = new Date(),
): BarraGanttLayout {
  const inicio = parseFechaPlan(tarea.fecha_inicio_planificada);
  const fin = parseFechaPlan(tarea.fecha_fin_planificada);
  const totalDias = diffDiasInclusive(timelineInicio, timelineFin);
  const offsetInicio = Math.max(0, diffDiasInclusive(timelineInicio, inicio) - 1);
  const duracion = diffDiasInclusive(inicio, fin);

  const leftPct = (offsetInicio / totalDias) * 100;
  const widthPct = Math.min(100 - leftPct, (duracion / totalDias) * 100);
  const avance = Math.min(100, Math.max(0, Number(tarea.porcentaje_avance) || 0));
  const progressWidthPct = (widthPct * avance) / 100;

  return {
    leftPct,
    widthPct: Math.max(widthPct, 0.8),
    progressWidthPct,
    estado: estadoBarraGantt(avance, inicio, fin, hoy),
    avance,
  };
}

export const COLORES_BARRA: Record<
  CronogramaBarraEstado,
  { plan: string; prog: string; borde: string }
> = {
  a_tiempo: {
    plan: 'bg-sky-500/25 border-sky-500/40',
    prog: 'bg-emerald-500/85',
    borde: 'border-emerald-400/50',
  },
  en_riesgo: {
    plan: 'bg-amber-500/20 border-amber-500/35',
    prog: 'bg-amber-500/80',
    borde: 'border-amber-400/50',
  },
  atrasada: {
    plan: 'bg-rose-500/15 border-rose-500/35',
    prog: 'bg-rose-600/90',
    borde: 'border-rose-500/60',
  },
  completada: {
    plan: 'bg-emerald-500/20 border-emerald-500/35',
    prog: 'bg-emerald-400/95',
    borde: 'border-emerald-300/50',
  },
};
