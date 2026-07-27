import fs from 'fs';
import path from 'path';
import { parseCsvMaestroRows, parseNumeroCsv } from '../lib/contabilidad/cco/parseCsvMaestro';

function pick(row: Record<string, string>, ...names: string[]): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase());
    if (k != null) return (row[k] ?? '').trim();
  }
  return '';
}

const root = path.join(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'tmp', 'RANCHO_20072026.csv'), 'utf8');
const rows = parseCsvMaestroRows(csv);
let ingCsvCol = 0;
let ingPy = 0;
let gasCsvCol = 0;
let gasPy = 0;
for (const r of rows) {
  const clase = (pick(r, 'CLASE') || 'GASTO').toUpperCase();
  const moneda = (pick(r, 'MONEDA') || 'USD').toUpperCase();
  const orig = parseNumeroCsv(pick(r, 'MONTO ORIG', 'MONTO_ORIG')) || 0;
  const tasa = parseNumeroCsv(pick(r, 'TASA')) || 0;
  const baseCol = parseNumeroCsv(pick(r, 'MONTO BASE USD', 'MONTO_BASE_USD', 'MONTO BASE')) || 0;
  const basePy = moneda && moneda !== 'USD' && orig > 0 && tasa > 0 ? orig / tasa : orig;
  if (clase === 'INGRESO') {
    ingCsvCol += baseCol;
    ingPy += basePy;
  } else if (clase === 'GASTO') {
    gasCsvCol += baseCol;
    gasPy += basePy;
  }
}
const r2 = (n: number) => Math.round(n * 100) / 100;
console.log({
  ingCsvCol: r2(ingCsvCol),
  ingPy: r2(ingPy),
  gasCsvCol: r2(gasCsvCol),
  gasPy: r2(gasPy),
});
