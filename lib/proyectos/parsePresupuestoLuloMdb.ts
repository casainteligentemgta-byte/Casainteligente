import MDBReader from 'mdb-reader';
import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import {
  normalizeLuloRow,
  pickFecha,
  pickField,
  pickNumber,
} from '@/lib/proyectos/luloFieldMapping';
import type { GastoObraLuloInsert, LuloMdbParseResult } from '@/types/lulo-import';

const PARTIDA_COLUMN_HINTS = [
  ['codigo_partida', 'codigo', 'partida', 'cod', 'item', 'rubro'],
  ['descripcion', 'desc', 'detalle', 'concepto', 'nombre'],
  ['unidad', 'und', 'um'],
  ['cantidad', 'cant', 'cantidad_presupuestada', 'qty'],
  ['precio_unitario', 'precio', 'unitario', 'p_unit', 'costo_unitario'],
  ['monto_total', 'monto', 'total', 'importe', 'subtotal'],
];

const GASTO_COLUMN_HINTS = [
  ['fecha', 'date', 'fec'],
  ['tipo', 'tipogasto', 'categoria'],
  ['disciplina', 'area', 'especialidad', 'rubro'],
  ['proveedor', 'supplier', 'razon_social'],
  ['descripcion', 'desc', 'concepto', 'detalle'],
  ['costo', 'monto', 'importe', 'valor', 'total'],
];

const PARTIDA_TABLE_HINTS = /partida|presupuesto|budget|detalle|items|rubro|apo/i;
const GASTO_TABLE_HINTS = /gasto|costo|factura|compra|egreso|movimiento|transacc/i;

function scoreTableColumns(columnNames: string[], hintGroups: string[][]): number {
  const lower = columnNames.map((c) => c.toLowerCase());
  let score = 0;
  for (const group of hintGroups) {
    if (group.some((h) => lower.some((col) => col.includes(h)))) score += 2;
  }
  return score;
}

function pickBestTable(
  reader: MDBReader,
  tableNames: string[],
  hintGroups: string[][],
  namePattern: RegExp,
): string | null {
  let best: { name: string; score: number; rows: number } | null = null;

  for (const name of tableNames) {
    if (name.startsWith('MSys')) continue;
    try {
      const table = reader.getTable(name);
      const cols = table.getColumnNames();
      let score = scoreTableColumns(cols, hintGroups);
      if (namePattern.test(name)) score += 5;
      const rows = table.rowCount;
      if (rows === 0) continue;
      if (!best || score > best.score || (score === best.score && rows > best.rows)) {
        best = { name, score, rows };
      }
    } catch {
      /* tabla inaccesible */
    }
  }

  return best && best.score >= 4 ? best.name : null;
}

function rowToPartida(row: Record<string, unknown>, proyectoId: string): PartidaLuloInsert | null {
  const r = normalizeLuloRow(row);
  const descripcion = pickField(r, ['descripcion', 'desc', 'detalle', 'concepto', 'nombre']);
  const codigo = pickField(r, ['codigo_partida', 'codigo', 'partida', 'cod', 'item', 'rubro']);
  if (!descripcion && !codigo) return null;

  const cantidad = pickNumber(r, ['cantidad', 'cant', 'cantidad_presupuestada', 'qty']);
  const precio = pickNumber(r, [
    'precio_unitario',
    'precio',
    'unitario',
    'p_unit',
    'costo_unitario',
  ]);
  const montoCsv = pickNumber(r, ['monto_total', 'monto', 'total', 'importe', 'subtotal']);
  const monto = montoCsv > 0 ? montoCsv : Math.round(cantidad * precio * 100) / 100;

  return {
    proyecto_id: proyectoId,
    codigo_partida: codigo,
    descripcion: descripcion || codigo,
    unidad: pickField(r, ['unidad', 'und', 'um']) || 'UND',
    cantidad_presupuestada: cantidad,
    precio_unitario_estimado: precio,
    monto_total_estimado: monto,
    origen: 'lulo_mdb',
  };
}

function rowToGasto(row: Record<string, unknown>, proyectoId: string): GastoObraLuloInsert | null {
  const r = normalizeLuloRow(row);
  const costo = pickNumber(r, ['costo', 'monto', 'importe', 'valor', 'total']);
  const proveedor = pickField(r, ['proveedor', 'supplier', 'razon_social']);
  const descripcion = pickField(r, ['descripcion', 'desc', 'concepto', 'detalle']);
  const tipo = pickField(r, ['tipo', 'tipogasto', 'categoria']);
  if (costo <= 0 && !proveedor && !descripcion) return null;

  return {
    proyecto_id: proyectoId,
    fecha: pickFecha(r, ['fecha', 'date', 'fec']),
    tipo: tipo || 'General',
    disciplina: pickField(r, ['disciplina', 'area', 'especialidad', 'rubro']) || 'Sin área',
    proveedor: proveedor || 'Sin proveedor',
    descripcion: descripcion || tipo || '—',
    costo,
    origen: 'lulo_mdb',
  };
}

function extractTableRows(reader: MDBReader, tableName: string): Record<string, unknown>[] {
  const table = reader.getTable(tableName);
  return table.getData() as Record<string, unknown>[];
}

/**
 * Lee un buffer MDB/ACCDB (Lulo / Access) y extrae partidas de presupuesto y gastos de obra.
 */
export function parsePresupuestoLuloMdb(buffer: Buffer, proyectoId: string): LuloMdbParseResult {
  const reader = new MDBReader(buffer);
  const tableNames = reader.getTableNames({ normalTables: true, systemTables: false });

  const partidasTable = pickBestTable(reader, tableNames, PARTIDA_COLUMN_HINTS, PARTIDA_TABLE_HINTS);
  const gastosTable = pickBestTable(reader, tableNames, GASTO_COLUMN_HINTS, GASTO_TABLE_HINTS);

  const partidas: PartidaLuloInsert[] = [];
  const gastos: GastoObraLuloInsert[] = [];
  let filasOmitidas = 0;

  if (partidasTable) {
    for (const row of extractTableRows(reader, partidasTable)) {
      const p = rowToPartida(row, proyectoId);
      if (p) partidas.push(p);
      else filasOmitidas++;
    }
  }

  if (gastosTable && gastosTable !== partidasTable) {
    for (const row of extractTableRows(reader, gastosTable)) {
      const g = rowToGasto(row, proyectoId);
      if (g) gastos.push(g);
      else filasOmitidas++;
    }
  } else if (!gastosTable) {
    // Si no hay tabla de gastos dedicada, intentar filas con fecha+costo en otras tablas
    for (const name of tableNames) {
      if (name === partidasTable || name.startsWith('MSys')) continue;
      const cols = reader.getTable(name).getColumnNames().map((c) => c.toLowerCase());
      const looksLikeGasto =
        cols.some((c) => c.includes('fecha')) &&
        cols.some((c) => /costo|monto|importe/.test(c)) &&
        scoreTableColumns(cols, GASTO_COLUMN_HINTS) >= 6;
      if (!looksLikeGasto) continue;
      for (const row of extractTableRows(reader, name)) {
        const g = rowToGasto(row, proyectoId);
        if (g) gastos.push(g);
      }
      break;
    }
  }

  const presupuestoTotalUsd = partidas.reduce((s, p) => s + p.monto_total_estimado, 0);

  return {
    partidas,
    gastos,
    meta: {
      tableNames,
      partidasTable,
      gastosTable: gastosTable ?? (gastos.length > 0 ? '(detectada)' : null),
      presupuestoTotalUsd: Math.round(presupuestoTotalUsd * 100) / 100,
      filasOmitidas,
    },
  };
}

/** Vista previa: solo nombres de tablas y columnas (sin insertar). */
export function inspectLuloMdb(buffer: Buffer) {
  const reader = new MDBReader(buffer);
  const tableNames = reader.getTableNames({ normalTables: true, systemTables: false });
  const tables = tableNames
    .filter((n) => !n.startsWith('MSys'))
    .map((name) => {
      try {
        const t = reader.getTable(name);
        return { name, rowCount: t.rowCount, columns: t.getColumnNames() };
      } catch {
        return { name, rowCount: 0, columns: [] as string[] };
      }
    });
  return { tables, creationDate: reader.getCreationDate()?.toISOString() ?? null };
}
