import fs from 'fs';
import path from 'path';
import { parseCsvMaestroRows } from '../lib/contabilidad/cco/parseCsvMaestro';

const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'tmp', 'RANCHO_20072026.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');
const raw = parseCsvMaestroRows(csvText);

for (const r of raw) {
  if (String(r['CLASE'] || '').includes('METADATA') || String(r['DESCRIPCION'] || '').includes('DEVALUACION')) {
    console.log(r);
  }
}
