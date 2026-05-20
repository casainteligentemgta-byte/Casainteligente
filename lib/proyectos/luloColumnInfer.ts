/** Normaliza nombre de columna Access/Lulo para comparar. */
export function normalizeColumnKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function findColumnByPattern(columnNames: string[], pattern: RegExp): string | null {
  for (const col of columnNames) {
    const n = normalizeColumnKey(col);
    if (pattern.test(n)) return col;
  }
  return null;
}

export function pickFieldFuzzy(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const k = key.toLowerCase();
    const direct = row[k] ?? row[normalizeColumnKey(key)];
    if (direct != null && direct !== '') return direct;
  }
  for (const hint of keys) {
    const h = hint.toLowerCase();
    for (const [col, val] of Object.entries(row)) {
      if ((col === h || col.includes(h) || h.includes(col)) && val) return val;
    }
  }
  return '';
}

export function pickNumberFuzzy(row: Record<string, string>, keys: string[]): number {
  const raw = pickFieldFuzzy(row, keys).replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const DESC_PAT =
  /descrip|concept|detalle|nombre|activid|obra|item|recurso|insumo|titulo|resumen|especific|trabajo|servicio/;
const COD_PAT = /codigo|cod_|^cod$|partida|part_|^part$|rubro|capitulo|cap_|item|numero|^num$|id_part/;
const CANT_PAT = /cantidad|cant_|^cant$|qty|cantidadpresup|cant_presup|volumen|metraje/;
const PRECIO_PAT = /precio|unitario|p_unit|punit|costo_unit|costounit|pu$|^pu_|pvp|preciou/;
const MONTO_PAT = /monto|total|importe|subtotal|valor|costo|preciototal|pt$|^pt_/;
const UND_PAT = /unidad|und_|^und$|um$|medida|uom/;

export function fieldFromCol(row: Record<string, string>, col: string | null): string {
  if (!col) return '';
  return row[normalizeColumnKey(col)] ?? '';
}

export function numberFromCol(row: Record<string, string>, col: string | null): number {
  if (!col) return 0;
  const raw = (row[normalizeColumnKey(col)] ?? '').replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export type TablaDiagnostico = {
  name: string;
  rowCount: number;
  columns: string[];
  partidaScore: number;
  gastoScore: number;
};

export { DESC_PAT, COD_PAT, CANT_PAT, PRECIO_PAT, MONTO_PAT, UND_PAT };
