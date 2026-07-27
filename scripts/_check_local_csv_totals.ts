import fs from 'fs';
import path from 'path';
import {
  mapCsvRowToRegistrosGastos,
  parseRegistrosGastosCsv,
} from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'tmp', 'RANCHO_20072026.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');

const PID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const { rows, skipped } = parseRegistrosGastosCsv(csvText, PID);

let ing = 0;
let gNet = 0;
let hon = 0;
let costo = 0;
for (const r of rows) {
  const c = String(r.clase ?? '').toUpperCase();
  const base = Number(r.monto_base_usd) || 0;
  if (c === 'INGRESO') {
    ing += base;
  } else if (c === 'GASTO') {
    gNet += base;
    hon += Number(r.honorarios) || 0;
    costo += Number(r.costo_total) || 0;
  }
}

console.log({
  ingresos: Math.round(ing * 100) / 100,
  gastosNetos: Math.round(gNet * 100) / 100,
  honorarios: Math.round(hon * 100) / 100,
  costoTotal: Math.round(costo * 100) / 100,
});
