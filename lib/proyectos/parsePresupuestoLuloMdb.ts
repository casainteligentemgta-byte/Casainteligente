import MDBReader from 'mdb-reader';
import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import {
  normalizeLuloRow,
  pickFecha,
  pickField,
  pickNumber,
} from '@/lib/proyectos/luloFieldMapping';
import { extractFullLuloMdb, type LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
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

export function scoreTableColumns(columnNames: string[], hintGroups: string[][]): number {
  const lower = columnNames.map((c) => c.toLowerCase());
  let score = 0;
  for (const group of hintGroups) {
    if (group.some((h) => lower.some((col) => col.includes(h)))) score += 2;
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

export type LuloMdbParseResultExtended = LuloMdbParseResult & {
  fullDump: LuloMdbFullDump;
  tablasPartidas: string[];
  tablasGastos: string[];
};

/**
 * Lee MDB/ACCDB: volcado completo + partidas/gastos de todas las tablas compatibles.
 */
export function parsePresupuestoLuloMdb(
  buffer: Buffer,
  proyectoId: string,
  importarGastos = true,
): LuloMdbParseResultExtended {
  const reader = new MDBReader(buffer);
  const fullDump = extractFullLuloMdb(buffer);
  const tableNames = reader.getTableNames({ normalTables: true, systemTables: false });

  const partidas: PartidaLuloInsert[] = [];
  const gastos: GastoObraLuloInsert[] = [];
  const partidaKeys = new Set<string>();
  const gastoKeys = new Set<string>();
  const tablasPartidas: string[] = [];
  const tablasGastos: string[] = [];
  let filasOmitidas = 0;

  for (const name of tableNames) {
    if (name.startsWith('MSys')) continue;
    let cols: string[] = [];
    let rows: Record<string, unknown>[] = [];
    try {
      const table = reader.getTable(name);
      cols = table.getColumnNames();
      if (table.rowCount === 0) continue;
      rows = extractTableRows(reader, name);
    } catch {
      continue;
    }

    const partidaScore = scoreTableColumns(cols, PARTIDA_COLUMN_HINTS);
    const gastoScore = scoreTableColumns(cols, GASTO_COLUMN_HINTS);
    const namePartidaBonus = PARTIDA_TABLE_HINTS.test(name) ? 5 : 0;
    const nameGastoBonus = GASTO_TABLE_HINTS.test(name) ? 5 : 0;
    const pScore = partidaScore + namePartidaBonus;
    const gScore = gastoScore + nameGastoBonus;

    if (pScore >= 4 && pScore >= gScore) {
      tablasPartidas.push(name);
      for (const row of rows) {
        const p = rowToPartida(row, proyectoId);
        if (!p) {
          filasOmitidas++;
          continue;
        }
        const key = partidaKey(p);
        if (partidaKeys.has(key)) continue;
        partidaKeys.add(key);
        partidas.push(p);
      }
    } else if (importarGastos && gScore >= 4) {
      tablasGastos.push(name);
      for (const row of rows) {
        const g = rowToGasto(row, proyectoId);
        if (!g) {
          filasOmitidas++;
          continue;
        }
        const key = gastoKey(g);
        if (gastoKeys.has(key)) continue;
        gastoKeys.add(key);
        gastos.push(g);
      }
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
      filasOmitidas,
      tablasPartidas,
      tablasGastos,
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
