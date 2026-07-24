import {
  normalizeLuloRow,
  parseLuloNumber,
  pickFecha,
  pickField,
  pickNumber,
} from '@/lib/proyectos/luloFieldMapping';
import { montoPartidaDesdeCantidadPrecio } from '@/lib/utils/numericDbLimits';
import type { GastoObraLuloInsert } from '@/types/lulo-import';
import { extractFullLuloCsv, type LuloCsvFullDump } from '@/lib/proyectos/extractLuloFull';

export type PartidaLuloInsert = {
  proyecto_id: string;
  codigo_partida: string;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  precio_unitario_estimado: number;
  monto_total_estimado: number;
  origen: string;
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
  capitulo_orden?: number | null;
};

function pickFieldCsv(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim() !== '') return String(direct).trim();
    const lower = row[key.toLowerCase()];
    if (lower != null && String(lower).trim() !== '') return String(lower).trim();
  }
  return '';
}

function pickNumberCsv(row: Record<string, string>, keys: string[]): number {
  return parseLuloNumber(pickFieldCsv(row, keys));
}

function rowToPartidaCsv(row: Record<string, string>, proyectoId: string): PartidaLuloInsert | null {
  const descripcion = pickFieldCsv(row, ['descripcion', 'Descripcion', 'DESCRIPCION', 'desc', 'concepto']);
  const codigo = pickFieldCsv(row, ['codigo_partida', 'Codigo', 'codigo', 'CODIGO', 'partida', 'rubro']);
  if (!descripcion && !codigo) return null;

  const cantidad = pickNumberCsv(row, ['cantidad', 'Cantidad', 'cantidad_presupuestada', 'CANTIDAD']);
  const precio = pickNumberCsv(row, [
    'precio_unitario',
    'Precio',
    'precio_unitario_estimado',
    'PRECIO',
    'precio',
  ]);
  const montoCsv = pickNumberCsv(row, ['monto_total', 'Monto', 'monto_total_estimado', 'total', 'importe']);
  const monto = montoPartidaDesdeCantidadPrecio(cantidad, precio, montoCsv > 0 ? montoCsv : undefined);

  return {
    proyecto_id: proyectoId,
    codigo_partida: codigo,
    descripcion: descripcion || codigo,
    unidad: pickFieldCsv(row, ['unidad', 'Unidad', 'UNIDAD']) || 'UND',
    cantidad_presupuestada: cantidad,
    precio_unitario_estimado: precio,
    monto_total_estimado: monto,
    origen: 'lulo_csv',
  };
}

function rowToGastoCsv(row: Record<string, string>, proyectoId: string): GastoObraLuloInsert | null {
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
    origen: 'lulo_csv',
  };
}

function scoreCsvAsGasto(headers: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  let score = 0;
  if (lower.some((c) => c.includes('fecha'))) score += 2;
  if (lower.some((c) => /costo|monto|importe/.test(c))) score += 2;
  if (lower.some((c) => c.includes('proveedor'))) score += 2;
  return score;
}

export type LuloCsvParseResult = {
  partidas: PartidaLuloInsert[];
  gastos: GastoObraLuloInsert[];
  fullDump: LuloCsvFullDump;
  meta: {
    presupuestoTotalUsd: number;
    filasOmitidas: number;
    esTablaGastos: boolean;
  };
};

export function parsePresupuestoLuloCsvComplete(
  text: string,
  proyectoId: string,
  importarGastos = true,
): LuloCsvParseResult {
  const fullDump = extractFullLuloCsv(text);
  const partidas: PartidaLuloInsert[] = [];
  const gastos: GastoObraLuloInsert[] = [];
  let filasOmitidas = 0;

  const esGasto = scoreCsvAsGasto(fullDump.headers) >= 6;

  for (const row of fullDump.rows) {
    if (esGasto && importarGastos) {
      const g = rowToGastoCsv(row, proyectoId);
      if (g) gastos.push(g);
      else filasOmitidas++;
    } else {
      const p = rowToPartidaCsv(row, proyectoId);
      if (p) partidas.push(p);
      else if (importarGastos) {
        const g = rowToGastoCsv(row, proyectoId);
        if (g) gastos.push(g);
        else filasOmitidas++;
      } else {
        filasOmitidas++;
      }
    }
  }

  const presupuestoTotalUsd = partidas.reduce((s, p) => s + p.monto_total_estimado, 0);

  return {
    partidas,
    gastos,
    fullDump,
    meta: {
      presupuestoTotalUsd: Math.round(presupuestoTotalUsd * 100) / 100,
      filasOmitidas,
      esTablaGastos: esGasto,
    },
  };
}

/** @deprecated Use parsePresupuestoLuloCsvComplete */
export function parsePresupuestoLuloCsv(text: string, proyectoId: string): PartidaLuloInsert[] {
  return parsePresupuestoLuloCsvComplete(text, proyectoId, false).partidas;
}
