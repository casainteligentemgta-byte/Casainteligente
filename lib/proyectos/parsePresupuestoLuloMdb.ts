import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import { assertMdbFileBuffer, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import { createMdbReader } from '@/lib/proyectos/loadMdbReader';
import {
  normalizeLuloRow,
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
import type { GastoObraLuloInsert, LuloMdbParseResult } from '@/types/lulo-import';

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
  /partida|presupuesto|budget|detalle|items|rubro|apo|capitulo|obra|activid|apu|unitario|concepto|recurso|insumo|presup/i;
const GASTO_TABLE_HINTS =
  /gasto|costo|factura|compra|egreso|movimiento|transacc|pago|cheque|nomina|proveedor/i;

const MIN_TABLE_SCORE = 2;

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
  if (!descripcion && !codigo) return null;

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

  return {
    proyecto_id: proyectoId,
    codigo_partida: codigo,
    descripcion: descripcion || codigo,
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
  if (!descripcion && !codigo) return null;

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

  return {
    proyecto_id: proyectoId,
    codigo_partida: codigo,
    descripcion: descripcion || codigo,
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
  if (entries.length < 2) return null;

  let desc = '';
  let cod = '';
  let maxText = '';
  const nums: { key: string; val: number }[] = [];

  for (const [k, v] of entries) {
    const cleaned = v.replace(/\s/g, '').replace(/,/g, '.');
    const n = Number(cleaned);
    if (Number.isFinite(n) && /^-?[\d.]+$/.test(cleaned)) {
      if (n !== 0) nums.push({ key: k, val: n });
    } else if (v.length > maxText.length && !/^(id|pk|fk|tipo|clasif|flag|activo)/.test(k)) {
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
  const monto = montoCol?.val ?? 0;
  const cantidad = cantCol?.val ?? 0;
  const precio = precCol?.val ?? 0;
  const total =
    monto > 0 ? monto : cantidad > 0 && precio > 0 ? Math.round(cantidad * precio * 100) / 100 : 0;

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

export type LuloMdbParseResultExtended = LuloMdbParseResult & {
  fullDump: LuloMdbFullDump;
  tablasPartidas: string[];
  tablasGastos: string[];
};

type TableCache = { name: string; cols: string[]; rows: Record<string, unknown>[] };

/**
 * Lee MDB/ACCDB: volcado completo + partidas/gastos de todas las tablas compatibles.
 */
export function parsePresupuestoLuloMdb(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  proyectoId: string,
  importarGastos = true,
): LuloMdbParseResultExtended {
  const nodeBuffer = toMdbNodeBuffer(buffer);
  assertMdbFileBuffer(nodeBuffer);
  const reader = createMdbReader(nodeBuffer);
  const fullDump = extractFullLuloMdb(nodeBuffer);
  const tableNames = reader.getTableNames({ normalTables: true, systemTables: false });
  const { tablas: tablasDiagnostico, resumen: diagnosticoResumen } = buildMdbDiagnostico(
    reader,
    tableNames,
  );

  const partidas: PartidaLuloInsert[] = [];
  const gastos: GastoObraLuloInsert[] = [];
  const partidaKeys = new Set<string>();
  const gastoKeys = new Set<string>();
  const tablasPartidas: string[] = [];
  const tablasGastos: string[] = [];
  const filasOmitidasRef = { n: 0 };
  const cachedTables: TableCache[] = [];

  for (const name of tableNames) {
    if (name.startsWith('MSys')) continue;
    let cols: string[] = [];
    let rows: Record<string, unknown>[] = [];
    try {
      const table = reader.getTable(name);
      cols = table.getColumnNames();
      if (table.rowCount === 0) continue;
      rows = extractTableRows(reader, name);
      cachedTables.push({ name, cols, rows });
    } catch {
      continue;
    }

    const partidaScore = scoreTableColumns(cols, PARTIDA_COLUMN_HINTS);
    const gastoScore = scoreTableColumns(cols, GASTO_COLUMN_HINTS);
    const namePartidaBonus = PARTIDA_TABLE_HINTS.test(name) ? 5 : 0;
    const nameGastoBonus = GASTO_TABLE_HINTS.test(name) ? 5 : 0;
    const pScore = partidaScore + namePartidaBonus;
    const gScore = gastoScore + nameGastoBonus;

    if (pScore >= MIN_TABLE_SCORE && pScore >= gScore) {
      tablasPartidas.push(name);
      for (const row of rows) {
        pushPartida(partidas, partidaKeys, rowToPartida(row, proyectoId), filasOmitidasRef);
      }
    } else if (importarGastos && gScore >= MIN_TABLE_SCORE && gScore > pScore) {
      tablasGastos.push(name);
      for (const row of rows) {
        pushGasto(gastos, gastoKeys, rowToGasto(row, proyectoId), filasOmitidasRef);
      }
    }
  }

  if (partidas.length === 0) {
    const byRows = [...cachedTables].sort((a, b) => b.rows.length - a.rows.length);
    for (const { name, cols, rows } of byRows) {
      if (rows.length < 2) continue;
      let added = 0;
      for (const row of rows) {
        const before = partidas.length;
        pushPartida(
          partidas,
          partidaKeys,
          rowToPartidaRelaxed(row, cols, proyectoId),
          filasOmitidasRef,
        );
        if (partidas.length > before) added++;
      }
      if (added > 0 && !tablasPartidas.includes(name)) tablasPartidas.push(name);
    }
  }

  if (partidas.length === 0) {
    const byRows = [...cachedTables].sort((a, b) => b.rows.length - a.rows.length);
    for (const { name, rows } of byRows) {
      if (rows.length < 3) continue;
      let added = 0;
      for (const row of rows) {
        const before = partidas.length;
        pushPartida(
          partidas,
          partidaKeys,
          inferPartidaFromUnknownLayout(row, proyectoId),
          filasOmitidasRef,
        );
        if (partidas.length > before) added++;
      }
      if (added > 0 && !tablasPartidas.includes(name)) tablasPartidas.push(`${name} (inferida)`);
    }
  }

  const presupuestoTotalUsd = partidas.reduce((s, p) => s + p.monto_total_estimado, 0);

  return {
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
