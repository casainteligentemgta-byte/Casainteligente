import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';
import type { LuloMdbFullDump, LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';

const INSUMOS_TABLE = /^insumos?$/i;
const PARTIDAS_TABLE = /^partidas?$/i;
const COMPOSICION_TABLE = /^composicion$/i;
const OBRAS_TABLE = /^obras?$/i;

const INSUMOS_ALT = /insumo|maestro.*insumo|catalogo.*insumo/i;
const PARTIDAS_ALT = /partida|presupuesto|detalle.*presup/i;
const COMPOSICION_ALT = /composicion|apu|analisis.*precio/i;
const OBRAS_ALT = /^obra$|datos.*obra/i;

export const LULO_INSUMO_COLS = {
  codigo: ['cod_ins', 'codigo', 'cod_insumo', 'codigo_insumo', 'cod'],
  descripcion: ['des_ins', 'descripcion', 'nombre', 'desc_insumo'],
  unidad: ['uni_ins', 'unidad', 'und', 'um'],
  precio: ['pre_ins', 'precio', 'precio_base', 'costo', 'pvp'],
  tipo: ['tip_ins', 'tipo', 'clase', 'categoria'],
} as const;

export const LULO_PARTIDA_COLS = {
  codigoObra: ['cod_obr', 'codigo_obra', 'obra', 'id_obra'],
  codigo: ['cod_par', 'codigo', 'codigo_partida', 'cod_partida', 'partida'],
  codigoCapitulo: ['cod_cap', 'codigo_capitulo', 'capitulo', 'cod_capitulo', 'cap'],
  descripcion: ['des_par', 'descripcion', 'concepto', 'detalle'],
  unidad: ['uni_par', 'unidad', 'und'],
  cantidad: ['can_par', 'cantidad', 'cant'],
  precio: ['pre_par', 'precio', 'precio_unitario', 'pu'],
} as const;

export const LULO_COMPOSICION_COLS = {
  codigoPartida: ['cod_par', 'codigo_partida', 'partida'],
  codigoInsumo: ['cod_ins', 'codigo_insumo', 'insumo'],
  cantidad: ['can_inc', 'cantidad', 'rendimiento', 'cant'],
  desperdicio: ['des_inc', 'desperdicio', 'porc_desperdicio', 'waste'],
} as const;

export const LULO_OBRA_COLS = {
  codigo: ['cod_obr', 'codigo', 'codigo_obra'],
  nombre: ['nom_obr', 'nombre', 'descripcion'],
  admin: ['per_adm', 'porcentaje_admin', 'admin'],
  utilidad: ['per_uti', 'porcentaje_utilidad', 'utilidad'],
  fcm: ['per_fcm', 'porcentaje_fcm', 'fcm'],
} as const;

function matchTableName(name: string, exact: RegExp, alt: RegExp): boolean {
  const n = name.trim();
  return exact.test(n) || alt.test(n);
}

export function findLuloTable(
  dump: LuloMdbFullDump,
  kind: 'insumos' | 'partidas' | 'composicion' | 'obras',
): LuloMdbTableDump | null {
  const tests: Record<typeof kind, [RegExp, RegExp]> = {
    insumos: [INSUMOS_TABLE, INSUMOS_ALT],
    partidas: [PARTIDAS_TABLE, PARTIDAS_ALT],
    composicion: [COMPOSICION_TABLE, COMPOSICION_ALT],
    obras: [OBRAS_TABLE, OBRAS_ALT],
  };
  const [exact, alt] = tests[kind];

  const canonical =
    kind === 'insumos'
      ? 'INSUMOS'
      : kind === 'partidas'
        ? 'PARTIDAS'
        : kind === 'composicion'
          ? 'COMPOSICION'
          : 'OBRAS';

  const byExact = dump.tables.find((t) => t.name.trim().toUpperCase() === canonical && t.rows.length > 0);
  if (byExact) return byExact;

  let best: LuloMdbTableDump | null = null;
  let bestRows = 0;
  for (const t of dump.tables) {
    if (t.name.startsWith('MSys') || t.rows.length === 0) continue;
    if (!matchTableName(t.name, exact, alt)) continue;
    if (t.rows.length > bestRows) {
      best = t;
      bestRows = t.rows.length;
    }
  }
  return best;
}

export function columnKeysNormalized(columns: string[]): Set<string> {
  return new Set(columns.map(normalizeColumnKey));
}

export function resolveLuloColumn(
  columns: string[],
  aliases: readonly string[],
): string | null {
  const normCols = columns.map((c) => ({ raw: c, norm: normalizeColumnKey(c) }));
  for (const alias of aliases) {
    const want = normalizeColumnKey(alias);
    const hit = normCols.find((c) => c.norm === want);
    if (hit) return hit.raw;
  }
  for (const alias of aliases) {
    const want = normalizeColumnKey(alias);
    const hit = normCols.find((c) => c.norm.includes(want) || want.includes(c.norm));
    if (hit) return hit.raw;
  }
  return null;
}

export function luloMdbHasEstructuraNativa(dump: LuloMdbFullDump): boolean {
  const partidas = findLuloTable(dump, 'partidas');
  if (!partidas || partidas.rows.length === 0) return false;
  const cols = columnKeysNormalized(partidas.columns);
  const hasCod =
    LULO_PARTIDA_COLS.codigo.some((a) => cols.has(normalizeColumnKey(a))) ||
    resolveLuloColumn(partidas.columns, LULO_PARTIDA_COLS.codigo) != null;
  const hasDesc =
    LULO_PARTIDA_COLS.descripcion.some((a) => cols.has(normalizeColumnKey(a))) ||
    resolveLuloColumn(partidas.columns, LULO_PARTIDA_COLS.descripcion) != null;
  return hasCod || hasDesc || partidas.name.trim().toUpperCase() === 'PARTIDAS';
}
