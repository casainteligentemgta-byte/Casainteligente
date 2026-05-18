export type PeriodoCompras = 'todas' | 'dia' | 'semana' | 'mes' | 'rango';

export type RangoFechas = { desde: string; hasta: string };

function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lunes como inicio de semana. */
function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function rangoFechasPeriodo(
  periodo: PeriodoCompras,
  refDate: string,
  rango?: Partial<RangoFechas>
): RangoFechas | null {
  if (periodo === 'todas') return null;

  const ref = parseLocalDate(refDate || todayIso());

  if (periodo === 'dia') {
    const d = refDate || todayIso();
    return { desde: d, hasta: d };
  }

  if (periodo === 'semana') {
    return {
      desde: toIsoDate(startOfWeek(ref)),
      hasta: toIsoDate(endOfWeek(ref)),
    };
  }

  if (periodo === 'mes') {
    return {
      desde: toIsoDate(startOfMonth(ref)),
      hasta: toIsoDate(endOfMonth(ref)),
    };
  }

  const desde = rango?.desde?.trim() || refDate || todayIso();
  const hasta = rango?.hasta?.trim() || desde;
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
}

export function etiquetaPeriodo(
  periodo: PeriodoCompras,
  refDate: string,
  rango: RangoFechas | null
): string {
  if (periodo === 'todas') return 'Todas las fechas';
  if (!rango) return '';
  if (rango.desde === rango.hasta) return rango.desde;
  return `${rango.desde} → ${rango.hasta}`;
}
