import fs from 'fs';
import path from 'path';
import { parseRegistrosGastosCsv } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

const root = path.join(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'tmp', 'RANCHO_20072026.csv'), 'utf8');
const { rows } = parseRegistrosGastosCsv(csv, 'x');
const row = rows.find((r) => String(r.descripcion).includes('CONCRETO ABONO'));
console.log(JSON.stringify(row, null, 2));
