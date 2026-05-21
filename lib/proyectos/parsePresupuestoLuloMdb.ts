import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import { assertMdbFileBuffer, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import { createMdbReader } from '@/lib/proyectos/loadMdbReader';
import {
  normalizeLuloRow,
  parseLuloNumber,
  pickFecha,
  pickField,
  pickNumber,
} from '@/lib/proyectos/luloFieldMapping';
import {
  CANT_PAT,
  COD_PAT,
  DESC_PAT,
  fieldFromCol,
  findColumnByPattern,
  MONTO_PAT,
  normalizeColumnKey,
  numberFromCol,
  PRECIO_PAT,
  type TablaDiagnostico,
  UND_PAT,
} from '@/lib/proyectos/luloColumnInfer';
import { extractFullLuloMdb, type LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import { cleanNum } from '@/lib/proyectos/luloCleanNumber';
import type {
  GastoObraLuloInsert,
  LuloMdbParseNeedsMapping,
  LuloMdbParseNeedsTableSelection,
  LuloMdbParseOutcome,
  LuloMdbParseResult,
} from '@/types/lulo-import';
import {
  columnsContainPartidaMapping,
  detectedColumnsFromFirstRecord,
  resolvePartidaMappingForColumns,
  type LuloCustomPartidaMapping,
  type LuloPartidaFieldMapping,
} from '@/lib/proyectos/luloStandardColumns';

const PARTIDA_COLUMN_HINTS = [
  ['codigo_partida', 'codigo', 'partida', 'cod', 'item', 'rubro', 'capitulo', 'subpartida', 'numero'],
  [
    'descripcion',
    'desc',
    'detalle',
    'concepto',
    'nombre',
    'actividad',
    'obra',
    'titulo',
    'resumen',
    'especificacion',
    'trabajo',
  ],
  ['unidad', 'und', 'um', 'unidad_medida', 'uom', 'medida'],
  ['cantidad', 'cant', 'cantidad_presupuestada', 'qty', 'volumen', 'metraje'],
  ['precio_unitario', 'precio', 'unitario', 'p_unit', 'costo_unitario', 'pu', 'preciou', 'pvp'],
  ['monto_total', 'monto', 'total', 'importe', 'subtotal', 'valor', 'pt', 'precio_total', 'costo_total'],
];

const GASTO_COLUMN_HINTS = [
  ['fecha', 'date', 'fec', 'fechagasto'],
  ['tipo', 'tipogasto', 'categoria', 'clasificacion'],
  ['disciplina', 'area', 'especialidad', 'rubro', 'capitulo'],
  ['proveedor', 'supplier', 'razon_social', 'beneficiario', 'contratista'],
  ['descripcion', 'desc', 'concepto', 'detalle', 'observacion'],
  ['costo', 'monto', 'importe', 'valor', 'total', 'pagado', 'debe'],
];

const PARTIDA_TABLE_HINTS =
  /partida|presupuesto|budget|detalle|items|rubro|apo|capitulo|obra|activid|apu|unitario|concepto|recurso|insumo|presup|composicion|analisis|estructura|catalogo|precio|tbl_|det_/i;
const GASTO_TABLE_HINTS =
  /gasto|costo|factura|compra|egreso|movimiento|transacc|pago|cheque|nomina|proveedor|egresos|compras/i;

const MIN_TABLE_SCORE = 1;

const RESUMEN_ROW_PAT =
  /^(total|subtotal|suma|resumen|gran\s*total|importe\s*total|presupuesto\s*total|total\s*general|total\s*obra)/i;

/** Nombres canónicos de tabla de partidas en exportaciones Lulo (case-insensitive). */
const CANONICAL_PARTIDA_TABLE_NAMES = [
  'partidas',
  'presupuesto',
  'partida',
  'presupuesto_obra',
  'detalle_presupuesto',
  'detallepresupuesto',
] as const;

const MIN_AUTO_PARTIDA_TABLE_SCORE = 1;

export { cleanNum } from '@/lib/proyectos/luloCleanNumber';

function filterUserTableNames(tableNames: string[]): string[] {
  return tableNames.filter((n) => !n.startsWith('MSys'));
}

function findTableByName(tableNames: string[], wanted: string): string | null {
  const w = wanted.trim().toLowerCase();
  return tableNames.find((t) => t.trim().toLowerCase() === w) ?? null;
}

/** Tabla Partidas o Presupuesto; o la indicada por el cliente. */
export function resolvePartidaTableName(
  tableNames: string[],
  opts?: { tableName?: string; selectedTable?: string; customMapping?: LuloCustomPartidaMapping },
): string | null {
  const userTable = (opts?.tableName ?? opts?.selectedTable)?.trim();
  if (userTable) {
    const hit = findTableByName(tableNames, userTable);
    if (hit) return hit;
  }
  const mappingTable = opts?.customMapping?.tableName?.trim();
  if (mappingTable) {
    const hit = findTableByName(tableNames, mappingTable);
    if (hit) return hit;
  }
  for (const canonical of CANONICAL_PARTIDA_TABLE_NAMES) {
    const hit = findTableByName(tableNames, canonical);
    if (hit) return hit;
  }
  return null;
}

/** Si no hay tabla «Partidas», elige la de mayor score heurístico con filas. */
export function pickBestPartidaTableFromDiagnostico(
  tablas: TablaDiagnostico[],
): string | null {
  const candidates = tablas
    .filter((t) => t.rowCount > 0 && t.partidaScore >= MIN_AUTO_PARTIDA_TABLE_SCORE)
    .sort((a, b) => b.partidaScore - a.partidaScore || b.rowCount - a.rowCount);
  return candidates[0]?.name ?? null;
}

export function scoreTableColumns(columnNames: string[], hintGroups: string[][]): number {
  const lower = columnNames.map((c) => normalizeColumnKey(c));
  let score = 0;
  for (const group of hintGroups) {
    if (group.some((h) => lower.some((col) => col.includes(h) || h.includes(col)))) score += 2;
  }
  return score;
}

function partidaKey(p: PartidaLuloInsert): string {
  return `${p.codigo_partida}|${p.descripcion}|${p.monto_total_estimado}|${p.cantidad_presupuestada}`;
}

function gastoKey(g: GastoObraLuloInsert): string {
  return `${g.fecha}|${g.proveedor}|${g.descripcion}|${g.costo}`;
}

function rowToPartida(row: Record<string, unknown>, proyectoId: string): PartidaLuloInsert | null {
  const r = normalizeLuloRow(row);
  const descripcion = pickField(r, [
    'descripcion',
    'desc',
    'detalle',
    'concepto',
    'nombre',
    'actividad',
    'obra',
    'titulo',
    'resumen',
  ]);
  const codigo = pickField(r, [
    'codigo_partida',
    'codigo',
    'partida',
    'cod',
    'item',
    'rubro',
    'capitulo',
    'subpartida',
    'numero',
  ]);
  const cantidad = pickNumber(r, ['cantidad', 'cant', 'cantidad_presupuestada', 'qty', 'volumen']);
  const precio = pickNumber(r, [
    'precio_unitario',
    'precio',
    'unitario',
    'p_unit',
    'costo_unitario',
    'pu',
    'preciou',
    'pvp',
  ]);
  const montoCsv = pickNumber(r, ['monto_total', 'monto', 'total', 'importe', 'subtotal', 'valor', 'pt']);
  const monto = montoCsv > 0 ? montoCsv : Math.round(cantidad * precio * 100) / 100;

  if (!descripcion && !codigo) {
    if (monto <= 0 && cantidad <= 0 && precio <= 0) return null;
  } else if (RESUMEN_ROW_PAT.test(descripcion) || RESUMEN_ROW_PAT.test(codigo)) {
    return null;
  }

  return {
    proyecto_id: proyectoId,
    codigo_partida: codigo,
    descripcion: descripcion || codigo || (monto > 0 ? 'Partida importada' : 'Sin descripción'),
    unidad: pickField(r, ['unidad', 'und', 'um', 'unidad_medida']) || 'UND',
    cantidad_presupuestada: cantidad,
    precio_unitario_estimado: precio,
    monto_total_estimado: monto,
    origen: 'lulo_mdb',
  };
}

function rowToPartidaRelaxed(
  row: Record<string, unknown>,
  colNames: string[],
  proyectoId: string,
): PartidaLuloInsert | null {
  const direct = rowToPartida(row, proyectoId);
  if (direct) return direct;

  const r = normalizeLuloRow(row);
  const descripcion =
    fieldFromCol(r, findColumnByPattern(colNames, DESC_PAT)) ||
    pickField(r, ['descripcion', 'desc', 'detalle', 'concepto', 'nombre', 'actividad', 'obra']);
  const codigo =
    fieldFromCol(r, findColumnByPattern(colNames, COD_PAT)) ||
    pickField(r, ['codigo_partida', 'codigo', 'partida', 'cod', 'item', 'rubro']);
  const cantidad =
    numberFromCol(r, findColumnByPattern(colNames, CANT_PAT)) ||
    pickNumber(r, ['cantidad', 'cant', 'qty']);
  const precio =
    numberFromCol(r, findColumnByPattern(colNames, PRECIO_PAT)) ||
    pickNumber(r, ['precio_unitario', 'precio', 'unitario', 'pu']);
  const montoCsv =
    numberFromCol(r, findColumnByPattern(colNames, MONTO_PAT)) ||
    pickNumber(r, ['monto_total', 'monto', 'total', 'importe']);
  const monto = montoCsv > 0 ? montoCsv : Math.round(cantidad * precio * 100) / 100;

  if (!descripcion && !codigo) {
    if (monto <= 0 && cantidad <= 0 && precio <= 0) return null;
  } else if (RESUMEN_ROW_PAT.test(descripcion) || RESUMEN_ROW_PAT.test(codigo)) {
    return null;
  }

  return {
    proyecto_id: proyectoId,
    codigo_partida: codigo,
    descripcion: descripcion || codigo || (monto > 0 ? 'Partida importada' : 'Sin descripción'),
    unidad:
      fieldFromCol(r, findColumnByPattern(colNames, UND_PAT)) ||
      pickField(r, ['unidad', 'und', 'um']) ||
      'UND',
    cantidad_presupuestada: cantidad,
    precio_unitario_estimado: precio,
    monto_total_estimado: monto,
    origen: 'lulo_mdb',
  };
}

/** Último recurso: infiere texto y montos sin nombres de columna conocidos. */
function inferPartidaFromUnknownLayout(
  row: Record<string, unknown>,
  proyectoId: string,
): PartidaLuloInsert | null {
  const r = normalizeLuloRow(row);
  const entries = Object.entries(r).filter(([, v]) => v !== '');
  if (entries.length < 1) return null;

  let desc = '';
  let cod = '';
  let maxText = '';
  const nums: { key: string; val: number }[] = [];

  for (const [k, v] of entries) {
    const cleaned = v.replace(/\s/g, '').replace(/,/g, '.');
    const n = Number(cleaned);
    const looksNumeric =
      Number.isFinite(n) &&
      ( /^-?[\d.]+$/.test(cleaned) || /^\d{1,3}(\.\d{3})+/.test(v.replace(/\s/g, '')) );
    if (looksNumeric && n !== 0) {
      nums.push({ key: k, val: Math.abs(n) });
    } else if (
      v.length > maxText.length &&
      v.length > 2 &&
      !/^(id|pk|fk|tipo|clasif|flag|activo|guid|uuid|orden|nivel|indice|index)/.test(k)
    ) {
      maxText = v;
    }
    if (COD_PAT.test(k)) cod = v;
    if (DESC_PAT.test(k)) desc = v;
  }

  desc = desc || maxText;
  if (!desc && !cod) return null;
  const descLower = desc.toLowerCase();
  if (
    /^(descripcion|concepto|codigo|partida|detalle|nombre|unidad|cantidad|precio|total)$/.test(
      descLower,
    )
  ) {
    return null;
  }

  const montoCol = nums.find((n) => MONTO_PAT.test(n.key));
  const cantCol = nums.find((n) => CANT_PAT.test(n.key));
  const precCol = nums.find((n) => PRECIO_PAT.test(n.key));
  const sortedNums = [...nums].sort((a, b) => b.val - a.val);
  const monto = montoCol?.val ?? sortedNums[0]?.val ?? 0;
  const cantidad = cantCol?.val ?? 0;
  const precio = precCol?.val ?? (sortedNums[1]?.val ?? 0);
  const total =
    monto > 0 ? monto : cantidad > 0 && precio > 0 ? Math.round(cantidad * precio * 100) / 100 : 0;

  if (RESUMEN_ROW_PAT.test(desc) || RESUMEN_ROW_PAT.test(cod)) return null;
  if (!desc && !cod && total <= 0) return null;

  return {
    proyecto_id: proyectoId,
    codigo_partida: cod,
    descripcion: desc || cod || 'Partida',
    unidad: 'UND',
    cantidad_presupuestada: cantidad,
    precio_unitario_estimado: precio,
    monto_total_estimado: total,
    origen: 'lulo_mdb',
  };
}

function rowToGasto(row: Record<string, unknown>, proyectoId: string): GastoObraLuloInsert | null {
  const r = normalizeLuloRow(row);
  const costo = pickNumber(r, ['costo', 'monto', 'importe', 'valor', 'total', 'pagado']);
  const proveedor = pickField(r, ['proveedor', 'supplier', 'razon_social', 'beneficiario']);
  const descripcion = pickField(r, ['descripcion', 'desc', 'concepto', 'detalle', 'observacion']);
  const tipo = pickField(r, ['tipo', 'tipogasto', 'categoria']);
  if (costo <= 0 && !proveedor && !descripcion) return null;

  return {
    proyecto_id: proyectoId,
    fecha: pickFecha(r, ['fecha', 'date', 'fec', 'fechagasto']),
    tipo: tipo || 'General',
    disciplina: pickField(r, ['disciplina', 'area', 'especialidad', 'rubro']) || 'Sin área',
    proveedor: proveedor || 'Sin proveedor',
    descripcion: descripcion || tipo || '—',
    costo,
    origen: 'lulo_mdb',
  };
}

function extractTableRows(reader: ReturnType<typeof createMdbReader>, tableName: string): Record<string, unknown>[] {
  const table = reader.getTable(tableName);
  return table.getData() as Record<string, unknown>[];
}

function buildMdbDiagnostico(
  reader: ReturnType<typeof createMdbReader>,
  tableNames: string[],
): { tablas: TablaDiagnostico[]; resumen: string } {
  const tablas: TablaDiagnostico[] = [];
  for (const name of tableNames) {
    if (name.startsWith('MSys')) continue;
    try {
      const t = reader.getTable(name);
      const cols = t.getColumnNames();
      const partidaScore =
        scoreTableColumns(cols, PARTIDA_COLUMN_HINTS) + (PARTIDA_TABLE_HINTS.test(name) ? 5 : 0);
      const gastoScore =
        scoreTableColumns(cols, GASTO_COLUMN_HINTS) + (GASTO_TABLE_HINTS.test(name) ? 5 : 0);
      tablas.push({
        name,
        rowCount: t.rowCount,
        columns: cols,
        partidaScore,
        gastoScore,
      });
    } catch {
      /* omit */
    }
  }
  tablas.sort((a, b) => b.partidaScore - a.partidaScore || b.rowCount - a.rowCount);
  const top = tablas
    .filter((t) => t.rowCount > 0)
    .slice(0, 6)
    .map(
      (t) =>
        `${t.name} (${t.rowCount} filas, score partidas ${t.partidaScore}, gastos ${t.gastoScore})`,
    );
  const resumen =
    top.length > 0
      ? `Tablas en el archivo: ${top.join('; ')}.`
      : 'No se leyeron tablas con datos en el MDB.';
  return { tablas, resumen };
}

function pushPartida(
  partidas: PartidaLuloInsert[],
  partidaKeys: Set<string>,
  p: PartidaLuloInsert | null,
  filasOmitidasRef: { n: number },
) {
  if (!p) {
    filasOmitidasRef.n++;
    return;
  }
  const key = partidaKey(p);
  if (partidaKeys.has(key)) return;
  partidaKeys.add(key);
  partidas.push(p);
}

function pushGasto(
  gastos: GastoObraLuloInsert[],
  gastoKeys: Set<string>,
  g: GastoObraLuloInsert | null,
  filasOmitidasRef: { n: number },
) {
  if (!g) {
    filasOmitidasRef.n++;
    return;
  }
  const key = gastoKey(g);
  if (gastoKeys.has(key)) return;
  gastoKeys.add(key);
  gastos.push(g);
}

function tryPartidaFromRow(
  row: Record<string, unknown>,
  colNames: string[],
  proyectoId: string,
): PartidaLuloInsert | null {
  return (
    rowToPartida(row, proyectoId) ??
    rowToPartidaRelaxed(row, colNames, proyectoId) ??
    inferPartidaFromUnknownLayout(row, proyectoId)
  );
}

function valueFromMappedColumn(r: Record<string, string>, col: string | undefined): string {
  if (!col) return '';
  return r[normalizeColumnKey(col)] ?? '';
}

function numberFromMappedColumn(r: Record<string, string>, col: string | undefined): number {
  return cleanNum(valueFromMappedColumn(r, col));
}

function rowToPartidaWithMapping(
  row: Record<string, unknown>,
  mapping: LuloPartidaFieldMapping,
  proyectoId: string,
  colNames: string[] = [],
): PartidaLuloInsert | null {
  const r = normalizeLuloRow(row);
  const descripcion = valueFromMappedColumn(r, mapping.descripcion);
  const codigo = valueFromMappedColumn(r, mapping.codigo);
  const cantidad = numberFromMappedColumn(r, mapping.cantidad);
  const precio = numberFromMappedColumn(r, mapping.precio);
  const montoCol = colNames.length ? findColumnByPattern(colNames, MONTO_PAT) : null;
  const montoCsv = montoCol ? numberFromCol(r, montoCol) : 0;
  const monto =
    montoCsv > 0
      ? montoCsv
      : Math.round(cantidad * precio * 100) / 100;

  if (!descripcion && !codigo) {
    if (monto <= 0 && cantidad <= 0 && precio <= 0) return null;
  } else if (RESUMEN_ROW_PAT.test(descripcion) || RESUMEN_ROW_PAT.test(codigo)) {
    return null;
  }

  return {
    proyecto_id: proyectoId,
    codigo_partida: codigo,
    descripcion: descripcion || codigo || (monto > 0 ? 'Partida importada' : 'Sin descripción'),
    unidad: valueFromMappedColumn(r, mapping.unidad) || 'UND',
    cantidad_presupuestada: cantidad,
    precio_unitario_estimado: precio,
    monto_total_estimado: monto,
    origen: 'lulo_mdb',
  };
}

function rowToGastoRelaxed(
  row: Record<string, unknown>,
  colNames: string[],
  proyectoId: string,
): GastoObraLuloInsert | null {
  const direct = rowToGasto(row, proyectoId);
  if (direct) return direct;
  const r = normalizeLuloRow(row);
  const costo =
    numberFromCol(r, findColumnByPattern(colNames, MONTO_PAT)) ||
    pickNumber(r, ['costo', 'monto', 'importe', 'valor', 'total', 'pagado']);
  const proveedor =
    pickField(r, ['proveedor', 'supplier', 'razon_social', 'beneficiario']) ||
    fieldFromCol(r, findColumnByPattern(colNames, /proveedor|beneficiario|razon/));
  const descripcion =
    pickField(r, ['descripcion', 'desc', 'concepto', 'detalle', 'observacion']) ||
    fieldFromCol(r, findColumnByPattern(colNames, DESC_PAT));
  if (costo <= 0 && !proveedor && !descripcion) return null;
  return {
    proyecto_id: proyectoId,
    fecha: pickFecha(r, ['fecha', 'date', 'fec', 'fechagasto']),
    tipo: pickField(r, ['tipo', 'tipogasto', 'categoria']) || 'General',
    disciplina: pickField(r, ['disciplina', 'area', 'especialidad', 'rubro']) || 'Sin área',
    proveedor: proveedor || 'Sin proveedor',
    descripcion: descripcion || '—',
    costo,
    origen: 'lulo_mdb',
  };
}

function tryGastoFromRow(
  row: Record<string, unknown>,
  colNames: string[],
  proyectoId: string,
): GastoObraLuloInsert | null {
  return rowToGasto(row, proyectoId) ?? rowToGastoRelaxed(row, colNames, proyectoId);
}

/** Importa cualquier fila con al menos un dato (modo «incluir todo»). */
function rowToPartidaCatchAll(
  row: Record<string, unknown>,
  tableName: string,
  rowIndex: number,
  proyectoId: string,
): PartidaLuloInsert | null {
  const relaxed =
    tryPartidaFromRow(row, [], proyectoId) ??
    inferPartidaFromUnknownLayout(row, proyectoId);
  if (relaxed) {
    if (!relaxed.codigo_partida) {
      relaxed.codigo_partida = `${tableName}-${rowIndex}`;
    }
    if (!relaxed.descripcion || relaxed.descripcion === 'Partida') {
      relaxed.descripcion = `${tableName} · fila ${rowIndex}`;
    }
    return relaxed;
  }

  const r = normalizeLuloRow(row);
  const entries = Object.entries(r).filter(([, v]) => v !== '');
  if (entries.length === 0) return null;

  const texts: string[] = [];
  let maxNum = 0;
  for (const [k, v] of entries) {
    if (/^(id|pk|fk|guid|uuid|orden|indice|index|tipo|flag|activo)$/i.test(normalizeColumnKey(k))) {
      continue;
    }
    const n = parseLuloNumber(v);
    if (n > maxNum) maxNum = n;
    if (v.length >= 2 && !/^-?[\d.,\s]+$/.test(v.replace(/\s/g, ''))) {
      texts.push(v);
    }
  }
  const desc = texts.sort((a, b) => b.length - a.length)[0] ?? '';
  if (!desc && maxNum <= 0) return null;
  if (RESUMEN_ROW_PAT.test(desc)) return null;

  return {
    proyecto_id: proyectoId,
    codigo_partida: `${tableName}-${rowIndex}`,
    descripcion: desc || `${tableName} · fila ${rowIndex}`,
    unidad: 'UND',
    cantidad_presupuestada: 0,
    precio_unitario_estimado: 0,
    monto_total_estimado: maxNum,
    origen: 'lulo_mdb',
  };
}

function importAllTablesAsPartidas(
  cachedTables: TableCache[],
  partidas: PartidaLuloInsert[],
  partidaKeys: Set<string>,
  tablasPartidas: string[],
  proyectoId: string,
  filasOmitidasRef: { n: number },
) {
  for (const table of cachedTables) {
    if (table.rows.length === 0) continue;
    let added = 0;
    let idx = 0;
    for (const row of table.rows) {
      idx += 1;
      const before = partidas.length;
      pushPartida(
        partidas,
        partidaKeys,
        rowToPartidaCatchAll(row, table.name, idx, proyectoId),
        filasOmitidasRef,
      );
      if (partidas.length > before) added += 1;
    }
    if (added > 0 && !tablasPartidas.includes(table.name)) {
      tablasPartidas.push(table.name);
    }
  }
}

function sweepTablesForPartidas(
  cachedTables: TableCache[],
  partidas: PartidaLuloInsert[],
  partidaKeys: Set<string>,
  tablasPartidas: string[],
  proyectoId: string,
  filasOmitidasRef: { n: number },
  minRows = 0,
) {
  const byRows = [...cachedTables].sort((a, b) => b.rows.length - a.rows.length);
  for (const { name, cols, rows } of byRows) {
    if (rows.length < minRows) continue;
    let added = 0;
    for (const row of rows) {
      const before = partidas.length;
      pushPartida(
        partidas,
        partidaKeys,
        tryPartidaFromRow(row, cols, proyectoId),
        filasOmitidasRef,
      );
      if (partidas.length > before) added++;
    }
    if (added > 0 && !tablasPartidas.includes(name)) tablasPartidas.push(name);
  }
}

function sweepTablesForGastos(
  cachedTables: TableCache[],
  gastos: GastoObraLuloInsert[],
  gastoKeys: Set<string>,
  tablasGastos: string[],
  proyectoId: string,
  filasOmitidasRef: { n: number },
) {
  const byRows = [...cachedTables].sort((a, b) => b.rows.length - a.rows.length);
  for (const { name, cols, rows } of byRows) {
    if (rows.length < 1) continue;
    let added = 0;
    for (const row of rows) {
      const before = gastos.length;
      pushGasto(gastos, gastoKeys, tryGastoFromRow(row, cols, proyectoId), filasOmitidasRef);
      if (gastos.length > before) added++;
    }
    if (added > 0 && !tablasGastos.includes(name)) tablasGastos.push(name);
  }
}

export type LuloMdbParseResultExtended = LuloMdbParseResult & {
  fullDump: LuloMdbFullDump;
  tablasPartidas: string[];
  tablasGastos: string[];
};

export type {
  LuloCustomPartidaMapping,
  LuloPartidaFieldMapping,
  defaultMapping,
} from '@/lib/proyectos/luloStandardColumns';

export {
  resolvePartidaMapping,
  resolvePartidaMappingForColumns,
  inferPartidaMappingFromColumns,
} from '@/lib/proyectos/luloStandardColumns';

export type LuloMdbParseOptions = {
  importarGastos?: boolean;
  /** Mapeo manual; sustituye campos de `defaultMapping`. */
  customMapping?: LuloCustomPartidaMapping;
  /** @deprecated Usar `customMapping`. */
  columnMapping?: LuloCustomPartidaMapping;
  /** Tabla Access cuando no existe Partidas/Presupuesto (POST `tableName`). */
  tableName?: string;
  /** @deprecated Usar `tableName`. */
  selectedTable?: string;
};

type TableCache = { name: string; cols: string[]; rows: Record<string, unknown>[] };

function normalizeParseOptions(
  importarGastosOrOptions: boolean | LuloMdbParseOptions = true,
): Required<Pick<LuloMdbParseOptions, 'importarGastos'>> &
  Pick<LuloMdbParseOptions, 'customMapping' | 'tableName'> {
  if (typeof importarGastosOrOptions === 'boolean') {
    return { importarGastos: importarGastosOrOptions };
  }
  return {
    importarGastos: importarGastosOrOptions.importarGastos ?? true,
    customMapping:
      importarGastosOrOptions.customMapping ?? importarGastosOrOptions.columnMapping,
    tableName:
      importarGastosOrOptions.tableName ?? importarGastosOrOptions.selectedTable,
  };
}

function loadTableIntoCache(
  reader: ReturnType<typeof createMdbReader>,
  name: string,
): TableCache | null {
  try {
    const table = reader.getTable(name);
    const cols = table.getColumnNames();
    if (table.rowCount === 0) return null;
    const rows = extractTableRows(reader, name);
    return { name, cols, rows };
  } catch {
    return null;
  }
}

function buildNeedsTableSelectionOutcome(input: {
  availableTables: string[];
  fullDump: LuloMdbFullDump;
  tableNames: string[];
  tablasDiagnostico: TablaDiagnostico[];
  diagnosticoResumen: string;
}): LuloMdbParseNeedsTableSelection {
  return {
    success: false,
    requireTableSelection: true,
    availableTables: input.availableTables,
    fullDump: input.fullDump,
    meta: {
      tableNames: input.tableNames,
      partidasTable: null,
      gastosTable: null,
      presupuestoTotalUsd: 0,
      filasOmitidas: 0,
      tablasPartidas: [],
      tablasGastos: [],
      diagnosticoResumen: input.diagnosticoResumen,
      tablasDiagnostico: input.tablasDiagnostico.slice(0, 12),
    },
  };
}

function buildNeedsMappingOutcome(input: {
  detectedColumns: string[];
  suggestedTable: string | null;
  fullDump: LuloMdbFullDump;
  tableNames: string[];
  tablasDiagnostico: TablaDiagnostico[];
  diagnosticoResumen: string;
}): LuloMdbParseNeedsMapping {
  return {
    success: false,
    requireMapping: true,
    detectedColumns: input.detectedColumns,
    suggestedTable: input.suggestedTable,
    fullDump: input.fullDump,
    meta: {
      tableNames: input.tableNames,
      partidasTable: input.suggestedTable,
      gastosTable: null,
      presupuestoTotalUsd: 0,
      filasOmitidas: 0,
      tablasPartidas: input.suggestedTable ? [input.suggestedTable] : [],
      tablasGastos: [],
      diagnosticoResumen: input.diagnosticoResumen,
      tablasDiagnostico: input.tablasDiagnostico.slice(0, 12),
    },
  };
}

function parsePartidasWithMapping(
  table: TableCache,
  mapping: LuloPartidaFieldMapping,
  proyectoId: string,
  partidas: PartidaLuloInsert[],
  partidaKeys: Set<string>,
  filasOmitidasRef: { n: number },
) {
  for (const row of table.rows) {
    pushPartida(
      partidas,
      partidaKeys,
      rowToPartidaWithMapping(row, mapping, proyectoId, table.cols),
      filasOmitidasRef,
    );
  }
}

function parsePartidasRelaxedOnTable(
  table: TableCache,
  proyectoId: string,
  partidas: PartidaLuloInsert[],
  partidaKeys: Set<string>,
  tablasPartidas: string[],
  filasOmitidasRef: { n: number },
) {
  const before = partidas.length;
  for (const row of table.rows) {
    pushPartida(
      partidas,
      partidaKeys,
      tryPartidaFromRow(row, table.cols, proyectoId),
      filasOmitidasRef,
    );
  }
  if (partidas.length > before && !tablasPartidas.includes(table.name)) {
    tablasPartidas.push(table.name);
  }
}

function cacheAllUserTables(
  reader: ReturnType<typeof createMdbReader>,
  tableNames: string[],
  cachedTables: TableCache[],
  skipName?: string,
) {
  const have = new Set(cachedTables.map((t) => t.name));
  for (const name of tableNames) {
    if (name === skipName || have.has(name)) continue;
    const loaded = loadTableIntoCache(reader, name);
    if (loaded) {
      cachedTables.push(loaded);
      have.add(name);
    }
  }
}

/** Analiza llaves del primer registro y mapeo resuelto (`defaultMapping` + `customMapping`). */
export function analyzePartidaTableColumns(
  table: TableCache,
  customMapping?: LuloCustomPartidaMapping,
) {
  const fromRow = detectedColumnsFromFirstRecord(table.cols, table.rows[0]);
  const detectedColumns = Array.from(new Set([...table.cols, ...fromRow]));
  const resolvedMapping = resolvePartidaMappingForColumns(detectedColumns, customMapping);
  const mappingReady = columnsContainPartidaMapping(detectedColumns, resolvedMapping);
  return { detectedColumns, resolvedMapping, mappingReady };
}

/**
 * Lee MDB/ACCDB: analiza columnas del primer registro, aplica defaultMapping/customMapping
 * y mapea a ci_presupuesto_partidas. Sin CodPar/DesPar infiere columnas y recorre todas las tablas.
 */
export function parsePresupuestoLuloMdb(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  proyectoId: string,
  importarGastosOrOptions: boolean | LuloMdbParseOptions = true,
): LuloMdbParseOutcome {
  const { importarGastos, customMapping, tableName } =
    normalizeParseOptions(importarGastosOrOptions);
  const nodeBuffer = toMdbNodeBuffer(buffer);
  assertMdbFileBuffer(nodeBuffer);
  const reader = createMdbReader(nodeBuffer);
  const fullDump = extractFullLuloMdb(nodeBuffer);
  const rawTableNames = reader.getTableNames();
  const tableNames = filterUserTableNames(rawTableNames);
  const { tablas: tablasDiagnostico, resumen: diagnosticoResumen } = buildMdbDiagnostico(
    reader,
    tableNames,
  );

  let partidaTableName = resolvePartidaTableName(tableNames, {
    tableName,
    customMapping,
  });
  if (!partidaTableName) {
    partidaTableName = pickBestPartidaTableFromDiagnostico(tablasDiagnostico);
  }
  if (!partidaTableName) {
    const conDatos = tablasDiagnostico.filter((t) => t.rowCount > 0);
    if (conDatos.length > 0) {
      partidaTableName = conDatos.sort((a, b) => b.rowCount - a.rowCount)[0].name;
    }
  }

  if (!partidaTableName) {
    return buildNeedsTableSelectionOutcome({
      availableTables: tableNames,
      fullDump,
      tableNames,
      tablasDiagnostico,
      diagnosticoResumen,
    });
  }

  const partidas: PartidaLuloInsert[] = [];
  const gastos: GastoObraLuloInsert[] = [];
  const partidaKeys = new Set<string>();
  const gastoKeys = new Set<string>();
  const tablasPartidas: string[] = [];
  const tablasGastos: string[] = [];
  const filasOmitidasRef = { n: 0 };
  const cachedTables: TableCache[] = [];

  const partidaTable = loadTableIntoCache(reader, partidaTableName);
  if (!partidaTable) {
    return buildNeedsTableSelectionOutcome({
      availableTables: tableNames,
      fullDump,
      tableNames,
      tablasDiagnostico,
      diagnosticoResumen,
    });
  }
  cachedTables.push(partidaTable);

  const { detectedColumns, resolvedMapping } = analyzePartidaTableColumns(
    partidaTable,
    customMapping,
  );

  tablasPartidas.push(partidaTable.name);
  parsePartidasWithMapping(
    partidaTable,
    resolvedMapping,
    proyectoId,
    partidas,
    partidaKeys,
    filasOmitidasRef,
  );

  if (partidas.length === 0) {
    parsePartidasRelaxedOnTable(
      partidaTable,
      proyectoId,
      partidas,
      partidaKeys,
      tablasPartidas,
      filasOmitidasRef,
    );
  }

  cacheAllUserTables(reader, tableNames, cachedTables, partidaTableName);

  if (partidas.length === 0) {
    sweepTablesForPartidas(
      cachedTables,
      partidas,
      partidaKeys,
      tablasPartidas,
      proyectoId,
      filasOmitidasRef,
      0,
    );
  }

  if (partidas.length === 0) {
    importAllTablesAsPartidas(
      cachedTables,
      partidas,
      partidaKeys,
      tablasPartidas,
      proyectoId,
      filasOmitidasRef,
    );
  }

  const cachedByName = new Map(cachedTables.map((t) => [t.name, t]));
  for (const name of tableNames) {
    if (name === partidaTableName) continue;
    const loaded = cachedByName.get(name) ?? loadTableIntoCache(reader, name);
    if (!loaded) continue;
    if (!cachedByName.has(name)) {
      cachedTables.push(loaded);
      cachedByName.set(name, loaded);
    }
    const { cols, rows } = loaded;
    const partidaScore = scoreTableColumns(cols, PARTIDA_COLUMN_HINTS);
    const gastoScore = scoreTableColumns(cols, GASTO_COLUMN_HINTS);
    const nameGastoBonus = GASTO_TABLE_HINTS.test(name) ? 5 : 0;
    const gScore = gastoScore + nameGastoBonus;

    if (importarGastos && gScore >= MIN_TABLE_SCORE) {
      tablasGastos.push(name);
      for (const row of rows) {
        pushGasto(gastos, gastoKeys, tryGastoFromRow(row, cols, proyectoId), filasOmitidasRef);
      }
    }
  }

  if (importarGastos && gastos.length === 0) {
    sweepTablesForGastos(
      cachedTables,
      gastos,
      gastoKeys,
      tablasGastos,
      proyectoId,
      filasOmitidasRef,
    );
  }

  if (partidas.length === 0 && gastos.length === 0) {
    const filasTabla = partidaTable.rows.length;
    const diagExtra =
      filasTabla > 0
        ? ` La tabla «${partidaTable.name}» tiene ${filasTabla} filas pero no se pudo extraer ningún registro.`
        : ' El MDB no tiene tablas con filas legibles.';
    return buildNeedsTableSelectionOutcome({
      availableTables: tableNames,
      fullDump,
      tableNames,
      tablasDiagnostico,
      diagnosticoResumen: `${diagnosticoResumen}${diagExtra}`,
    });
  }

  const presupuestoTotalUsd = partidas.reduce((s, p) => s + p.monto_total_estimado, 0);

  return {
    success: true,
    partidas,
    gastos,
    fullDump,
    tablasPartidas,
    tablasGastos,
    meta: {
      tableNames,
      partidasTable: tablasPartidas[0] ?? null,
      gastosTable: tablasGastos[0] ?? null,
      presupuestoTotalUsd: Math.round(presupuestoTotalUsd * 100) / 100,
      filasOmitidas: filasOmitidasRef.n,
      tablasPartidas,
      tablasGastos,
      diagnosticoResumen,
      tablasDiagnostico: tablasDiagnostico.slice(0, 12),
      modoImportacion: 'auto_todas_tablas',
      columnasDetectadas: detectedColumns.slice(0, 24),
      mapeoInferido: resolvedMapping,
    },
  };
}

/** Vista previa: tablas, columnas y puntuación heurística (sin insertar). */
export function inspectLuloMdb(buffer: Buffer | ArrayBuffer | Uint8Array) {
  const nodeBuffer = toMdbNodeBuffer(buffer);
  assertMdbFileBuffer(nodeBuffer);
  const reader = createMdbReader(nodeBuffer);
  const tableNames = reader.getTableNames({ normalTables: true, systemTables: false });
  const { tablas, resumen } = buildMdbDiagnostico(reader, tableNames);
  const tables = tablas.map((t) => ({
    name: t.name,
    rowCount: t.rowCount,
    columns: t.columns,
    partidaScore: t.partidaScore,
    gastoScore: t.gastoScore,
  }));
  return {
    tables,
    diagnosticoResumen: resumen,
    creationDate: reader.getCreationDate()?.toISOString() ?? null,
  };
}
