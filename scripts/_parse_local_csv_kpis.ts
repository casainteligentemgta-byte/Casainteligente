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
let nIng = 0;
let gNet = 0;
let nGas = 0;
for (const r of rows) {
  const c = String(r.clase ?? '').toUpperCase();
  const base = Number(r.monto_base_usd) || 0;
  if (c === 'INGRESO') {
    ing += base;
    nIng++;
  } else if (c === 'GASTO') {
    gNet += base;
    nGas++;
  }
}

console.log(
  JSON.stringify(
    {
      file: path.basename(csvPath),
      parsed: rows.length,
      skipped,
      nIng,
      nGas,
      ingresos: Math.round(ing * 100) / 100,
      gastosNetos: Math.round(gNet * 100) / 100,
    },
    null,
    2,
  ),
);
