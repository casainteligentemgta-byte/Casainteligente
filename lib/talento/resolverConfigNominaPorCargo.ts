/**
 * Resuelve un cargo de listado de obra (p. ej. AYUDANTE, CARPINTERO, TOPOGRAFO)
 * contra filas de `ci_config_nomina` (tabulador GOE / Convención Colectiva).
 */

export type ConfigNominaMatchRow = {
  id: string;
  cargo_nombre: string;
  nivel_salarial?: number | null;
};

export function normCargoKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nombres del listado de personal / Excel → denominación a buscar en el tabulador.
 * (El listado suele abreviar; el tabulador usa grado 1ra/2da u oficio compuesto.)
 */
const ALIAS_LISTADO_A_BUSQUEDA: Record<string, string> = {
  // Oficios abreviados
  carpintero: 'carpintero',
  albanil: 'albanil',
  operador: 'operador de equipo liviano',
  // Topografía: en GOE solo existe «Ayudante de Topógrafo»
  topografo: 'ayudante de topografo',
  // Multioficio / «utilities» (grafías frecuentes en obra)
  utilitis: 'ayudante',
  utilities: 'ayudante',
  utility: 'ayudante',
  utilites: 'ayudante',
  utilitie: 'ayudante',
  utilitario: 'ayudante',
  utilitiesman: 'ayudante',
  // Supervisión / ingeniería (no están oficios GOE de obrero; se acercan a Maestro de Obra / Caporal)
  'ingeniero supervisor': 'maestro de obra',
  'ing supervisor': 'maestro de obra',
  'ingeniero civil': 'maestro de obra',
  ingeniero: 'maestro de obra',
  supervisor: 'caporal',
  'supervisor de obra': 'maestro de obra',
  'maestro obra': 'maestro de obra',
  'maestro de obras': 'maestro de obra',
};

/** Preferencia de fila cuando el label (ya expandido) coincide con varios candidatos. */
const SINONIMOS_PREFERIDOS: Record<string, string[]> = {
  operador: ['operador de equipo liviano', 'operador de equipo', 'operador'],
  'operador de equipo liviano': ['operador de equipo liviano', 'operador de equipo', 'operador'],
  carpintero: ['carpintero de 1era', 'carpintero de 1ra', 'carpintero de 2da', 'carpintero'],
  albanil: ['albanil de 1era', 'albanil de 1ra', 'albanil de 2da', 'albanil'],
  ayudante: ['ayudante'],
  'ayudante de topografo': ['ayudante de topografo'],
  'maestro de obra': ['maestro de obra de 1ra', 'maestro de obra de 1era', 'maestro de obra de 2da', 'maestro de obra'],
  caporal: ['caporal'],
};

function expandLabelsParaBusqueda(cargoLabel: string): string[] {
  const raw = normCargoKey(cargoLabel);
  if (!raw) return [];
  const out: string[] = [raw];
  const alias = ALIAS_LISTADO_A_BUSQUEDA[raw];
  if (alias) out.push(normCargoKey(alias));

  // «INGENIERO SUPERVISOR DE OBRA» → probar también clave de 2 tokens
  const parts = raw.split(' ');
  if (parts.length >= 2) {
    const two = `${parts[0]} ${parts[1]}`;
    const a2 = ALIAS_LISTADO_A_BUSQUEDA[two];
    if (a2) out.push(normCargoKey(a2));
  }
  // Primera palabra significativa (≥5) como respaldo (p. ej. INGENIERO …)
  if (parts[0] && parts[0].length >= 5) {
    const a0 = ALIAS_LISTADO_A_BUSQUEDA[parts[0]];
    if (a0) out.push(normCargoKey(a0));
  }

  return Array.from(new Set(out));
}

function scoreMatch(
  labelNorm: string,
  row: ConfigNominaMatchRow,
  nivelPreferido: number | null,
): number {
  const L = labelNorm;
  const N = normCargoKey(row.cargo_nombre);
  if (!L || !N) return -1;

  let score = 0;
  if (N === L) score = 100;
  else if (N.startsWith(`${L} `) || N.startsWith(`${L} de`)) score = 80;
  else if (new RegExp(`(^|\\s)${L.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(N)) score = 60;
  else if (N.includes(L) && L.length >= 5) score = 45;
  else if (L.includes(N) && N.length >= 5) score = 42;
  else return -1;

  const prefs = SINONIMOS_PREFERIDOS[L];
  if (prefs?.length) {
    const idx = prefs.findIndex((p) => {
      const P = normCargoKey(p);
      return N === P || N.startsWith(`${P} `) || N.startsWith(`${P}.`);
    });
    if (idx >= 0) score += 25 - idx * 2;
  }

  if (nivelPreferido != null) {
    if (nivelPreferido >= 5 && /\b1(era|ra|ª)\b/.test(N)) score += 12;
    if (nivelPreferido <= 4 && /\b2(da|ª)\b/.test(N)) score += 12;
    if (row.nivel_salarial != null && Number(row.nivel_salarial) === nivelPreferido) {
      score += 8;
    }
  }

  // Preferir denominaciones más cortas ante empate (Ayudante > Ayudante de Operadores),
  // salvo cuando el label ya pide el compuesto (ayudante de topografo).
  if (!L.includes(' ')) {
    score += Math.max(0, 10 - Math.min(10, N.length / 8));
  } else {
    score += Math.max(0, 6 - Math.min(6, Math.abs(N.length - L.length) / 10));
  }
  return score;
}

/**
 * Devuelve el id de config_nomina que mejor encaja con el cargo del Excel.
 * null si no hay candidato razonable.
 */
export function resolverConfigNominaPorCargo(
  cargoLabel: string,
  configs: ConfigNominaMatchRow[],
  opts?: { nivelGenerico?: number | null },
): { id: string; cargo_nombre: string; score: number } | null {
  const label = (cargoLabel ?? '').trim();
  if (!label || configs.length === 0) return null;

  const nivel =
    opts?.nivelGenerico != null && Number.isFinite(Number(opts.nivelGenerico))
      ? Math.round(Number(opts.nivelGenerico))
      : null;

  const labels = expandLabelsParaBusqueda(label);
  let best: { id: string; cargo_nombre: string; score: number } | null = null;

  for (const L of labels) {
    for (const row of configs) {
      const score = scoreMatch(L, row, nivel);
      if (score < 40) continue;
      if (!best || score > best.score) {
        best = { id: row.id, cargo_nombre: row.cargo_nombre, score };
      }
    }
  }
  return best;
}
