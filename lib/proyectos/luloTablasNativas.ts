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
  codigo: ['cod_ins', 'codins', 'codigo', 'cod_insumo', 'codigo_insumo', 'cod'],
  descripcion: ['des_ins', 'desins', 'descripcion', 'nombre', 'desc_insumo'],
  unidad: ['uni_ins', 'uniins', 'unidad', 'und', 'um'],
  precio: ['pre_ins', 'preins', 'precio', 'precio_base', 'costo', 'pvp', 'pre_uni', 'unitario', 'cosins'],
  tipo: ['tip_ins', 'tipins', 'tipo', 'clase', 'categoria'],
} as const;

export const LULO_PARTIDA_COLS = {
  codigoObra: ['cod_obr', 'codobr', 'codigo_obra', 'obra', 'id_obra'],
  codigo: ['cod_par', 'codpar', 'codigo', 'codigo_partida', 'cod_partida', 'partida'],
  codigoCapitulo: ['cod_cap', 'codcap', 'codigo_capitulo', 'capitulo', 'cod_capitulo', 'cap'],
  descripcion: ['des_par', 'despar', 'descripcion', 'concepto', 'detalle'],
  unidad: ['uni_par', 'unipar', 'unidad', 'und'],
  cantidad: ['can_par', 'canpar', 'cantidad', 'cant'],
  precio: [
    'pre_par',
    'prepar',
    'precio',
    'precio_unitario',
    'pu',
    'costo_unitario',
    'cospar',
    'cos_par',
    'pventa',
    'precio_venta',
    'preuni',
    'pre_uni',
    'pvp',
    'unitario',
  ],
  monto: [
    'mon_par',
    'monpar',
    'monto_par',
    'tot_par',
    'totpar',
    'imp_par',
    'imppar',
    'imptot',
    'imp_tot',
    'monto',
    'monto_total',
    'total',
    'importe',
    'parcial',
    'pt',
    'costo_total',
    'valor',
    'valpar',
    'val_par',
    'cosgen',
    'cos_gen',
    'subtotal',
  ],
} as const;

export const LULO_COMPOSICION_COLS = {
  codigoPartida: ['cod_par', 'codpar', 'codigo_partida', 'partida'],
  codigoInsumo: ['cod_ins', 'codins', 'codigo_insumo', 'insumo'],
  cantidad: ['can_inc', 'caninc', 'cantidad', 'rendimiento', 'cant'],
  desperdicio: ['des_inc', 'desinc', 'desperdicio', 'porc_desperdicio', 'waste'],
} as const;

export const LULO_OBRA_COLS = {
  codigo: ['cod_obr', 'codobr', 'codigo', 'codigo_obra'],
  nombre: ['nom_obr', 'nomobr', 'nombre', 'descripcion'],
  admin: ['per_adm', 'peradm', 'porcentaje_admin', 'admin'],
  utilidad: ['per_uti', 'peruti', 'porcentaje_utilidad', 'utilidad'],
  fcm: ['per_fcm', 'perfcm', 'porcentaje_fcm', 'fcm'],
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

/** Clave compacta: CodPar y cod_par → codpar (Access Lulo sin guiones bajos). */
function compactColumnKey(k: string): string {
  return normalizeColumnKey(k).replace(/_/g, '');
}

export function resolveLuloColumn(
  columns: string[],
  aliases: readonly string[],
): string | null {
  const normCols = columns.map((c) => ({ raw: c, compact: compactColumnKey(c) }));
  for (const alias of aliases) {
    const want = compactColumnKey(alias);
    const hit = normCols.find((c) => c.compact === want);
    if (hit) return hit.raw;
  }
  for (const alias of aliases) {
    const want = compactColumnKey(alias);
    const hit = normCols.find((c) => c.compact.includes(want) || want.includes(c.compact));
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
