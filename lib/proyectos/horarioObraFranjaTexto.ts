/** Días de la semana (clave interna). */
export type DiaObraCodigo = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

export const ORDEN_DIAS_OBRA: DiaObraCodigo[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

export const ETIQUETA_DIA_CORTA: Record<DiaObraCodigo, string> = {
  lun: 'L',
  mar: 'M',
  mie: 'X',
  jue: 'J',
  vie: 'V',
  sab: 'S',
  dom: 'D',
};

const NOMBRE_DIA: Record<DiaObraCodigo, string> = {
  lun: 'lunes',
  mar: 'martes',
  mie: 'miércoles',
  jue: 'jueves',
  vie: 'viernes',
  sab: 'sábado',
  dom: 'domingo',
};

function indiceDia(d: DiaObraCodigo): number {
  return ORDEN_DIAS_OBRA.indexOf(d);
}

function esConsecutivo(run: DiaObraCodigo[]): boolean {
  for (let i = 1; i < run.length; i++) {
    if (indiceDia(run[i]) !== indiceDia(run[i - 1]) + 1) return false;
  }
  return run.length > 0;
}

/** Agrupa días seleccionados en tramos consecutivos (orden calendario). */
export function agruparDiasConsecutivos(dias: DiaObraCodigo[]): DiaObraCodigo[][] {
  const u = [...new Set(dias)].sort((a, b) => indiceDia(a) - indiceDia(b));
  const runs: DiaObraCodigo[][] = [];
  let cur: DiaObraCodigo[] = [];
  for (const d of u) {
    if (!cur.length) {
      cur.push(d);
      continue;
    }
    if (indiceDia(d) === indiceDia(cur[cur.length - 1]) + 1) cur.push(d);
    else {
      runs.push(cur);
      cur = [d];
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** Formato 12 h en español (VE), p. ej. 7:00 a.m.; mediodía como 12:00 p.m. (contratos). */
export function formatHoraContratoEs(hhmm: string): string {
  const m = (hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm || '—';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return hhmm;
  if (h === 12 && min === 0) return '12:00 p.m.';
  const d = new Date(2000, 0, 1, h, min, 0, 0);
  if (Number.isNaN(d.getTime())) return hhmm;
  let s = d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', hour12: true });
  s = s.replace(/\s*a\.\s*m\.\s*/gi, ' a.m.').replace(/\s*p\.\s*m\.\s*/gi, ' p.m.');
  return s.trim();
}

function fraseDiasRun(run: DiaObraCodigo[]): string {
  if (run.length === 0) return '';
  if (run.length === 1) return NOMBRE_DIA[run[0]];
  if (run.length === 2) {
    if (esConsecutivo(run)) return `${NOMBRE_DIA[run[0]]} a ${NOMBRE_DIA[run[1]]}`;
    return `${NOMBRE_DIA[run[0]]} y ${NOMBRE_DIA[run[1]]}`;
  }
  if (esConsecutivo(run)) return `${NOMBRE_DIA[run[0]]} a ${NOMBRE_DIA[run[run.length - 1]]}`;
  return run.map((x) => NOMBRE_DIA[x]).reduce((acc, n, i, arr) => {
    if (i === 0) return n;
    if (i === arr.length - 1) return `${acc} y ${n}`;
    return `${acc}, ${n}`;
  }, '');
}

export type FranjaHorarioObra = {
  id: string;
  dias: DiaObraCodigo[];
  inicio: string;
  fin: string;
};

/** Construye el párrafo para `ci_proyectos.horario_semanal_obra_default` (contrato PDF). */
export function franjasHorarioObraATexto(franjas: FranjaHorarioObra[]): string {
  const partes: string[] = [];
  for (const f of franjas) {
    if (!f.dias.length) continue;
    const hi = formatHoraContratoEs(f.inicio);
    const hf = formatHoraContratoEs(f.fin);
    const runs = agruparDiasConsecutivos(f.dias);
    const sub = runs
      .map((run) => {
        const d = fraseDiasRun(run);
        if (!d) return '';
        const conRango = run.length >= 2 && esConsecutivo(run);
        if (run.length === 1) return `los ${d} de ${hi} a ${hf}`;
        if (conRango) return `De ${d}, de ${hi} a ${hf}`;
        return `Los días ${d}, de ${hi} a ${hf}`;
      })
      .filter(Boolean);
    if (sub.length === 1) partes.push(sub[0]);
    else partes.push(sub.join('; '));
  }
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return `${partes[0]} y ${partes[1]}`;
  return partes.join('; ');
}

function nuevaIdFranja(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Lun–jue 7–17 y vie 7–12 (alineado al contrato tipo Casa Inteligente). */
export function franjasHorarioPorDefecto(): FranjaHorarioObra[] {
  return [
    { id: nuevaIdFranja(), dias: ['lun', 'mar', 'mie', 'jue'], inicio: '07:00', fin: '17:00' },
    { id: nuevaIdFranja(), dias: ['vie'], inicio: '07:00', fin: '12:00' },
  ];
}
