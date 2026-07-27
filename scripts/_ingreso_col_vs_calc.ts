import fs from 'fs';
import path from 'path';
import { parseCsvMaestroRows, parseNumeroCsv } from '../lib/contabilidad/cco/parseCsvMaestro';

const csvPath = path.join(__dirname, '..', 'tmp', 'RANCHO_20072026.csv');
const raw = parseCsvMaestroRows(fs.readFileSync(csvPath, 'utf8'));

function pick(row: Record<string, string>, name: string): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]));
  const k = lower.get(name.toLowerCase());
  return k ? (row[k] ?? '').trim() : '';
}

const diffs: unknown[] = [];
for (const r of raw) {
  if (String(pick(r, 'CLASE')).toUpperCase() !== 'INGRESO') continue;
  const colBase = parseNumeroCsv(pick(r, 'MONTO BASE USD')) ?? 0;
  const orig = parseNumeroCsv(pick(r, 'MONTO ORIG')) ?? 0;
  const tasa = parseNumeroCsv(pick(r, 'TASA')) ?? 0;
  const moneda = pick(r, 'MONEDA').toUpperCase();
  let calc = orig;
  if (moneda && moneda !== 'USD' && orig > 0 && tasa > 0) calc = orig / tasa;
  if (Math.abs(colBase - calc) > 0.02 && colBase > 0 && calc > 0) {
    diffs.push({
      d: pick(r, 'DESCRIPCION').slice(0, 35),
      moneda,
      colBase,
      calc: Math.round(calc * 100) / 100,
      orig,
      tasa,
    });
  }
}
console.log('ingreso col vs orig/tasa diffs', diffs.length);
console.log(diffs.slice(0, 15));
