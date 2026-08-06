/**
 * Resuelve un cargo de listado de obra (p. ej. AYUDANTE, CARPINTERO)
 * contra filas de `ci_config_nomina`.
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

function scoreMatch(
  label: string,
  row: ConfigNominaMatchRow,
  nivelPreferido: number | null,
): number {
  const L = normCargoKey(label);
  const N = normCargoKey(row.cargo_nombre);
  if (!L || !N) return -1;

  let score = 0;
  if (N === L) score = 100;
  else if (N.startsWith(`${L} `) || N.startsWith(`${L} de`)) score = 80;
  else if (new RegExp(`(^|\\s)${L.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(N)) score = 60;
  else if (N.includes(L) && L.length >= 5) score = 40;
  else return -1;

  if (nivelPreferido != null && row.nivel_salarial != null && Number(row.nivel_salarial) === nivelPreferido) {
    score += 15;
  }
  // Preferir denominaciones más cortas (menos específicas) ante empate cercano:
  // p. ej. «Ayudante» sobre «Ayudante de Operadores» cuando el listado dice AYUDANTE.
  score += Math.max(0, 10 - Math.min(10, N.length / 8));
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

  let best: { id: string; cargo_nombre: string; score: number } | null = null;
  for (const row of configs) {
    const score = scoreMatch(label, row, nivel);
    if (score < 40) continue;
    if (!best || score > best.score) {
      best = { id: row.id, cargo_nombre: row.cargo_nombre, score };
    }
  }
  return best;
}
