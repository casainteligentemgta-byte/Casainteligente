import fs from 'fs';
import path from 'path';
import { applyDerivedCsvMontos, parseCsvMaestroRows } from '../lib/contabilidad/cco/parseCsvMaestro';
import { mapCsvRowToRegistrosGastos } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

const root = path.join(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'tmp', 'RANCHO_20072026.csv'), 'utf8');
const rows = parseCsvMaestroRows(csv);
let raw = 0;
let derived = 0;
let n = 0;
for (const r of rows) {
  const m = mapCsvRowToRegistrosGastos(r);
  if (!m || String(m.clase).toUpperCase() !== 'GASTO') continue;
  n++;
  raw += Number(m.monto_base_usd) || 0;
  const d = applyDerivedCsvMontos({ ...m, tasa: m.tasa }, 15);
  derived += Number(d.monto_base_usd) || 0;
}
console.log({ n, raw: Math.round(raw * 100) / 100, derived: Math.round(derived * 100) / 100 });
