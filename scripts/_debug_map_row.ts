import fs from 'fs';
import path from 'path';
import { mapCsvRowToRegistrosGastos } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

function split(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else q = !q;
      continue;
    }
    if (ch === ',' && !q) {
      out.push(cell);
      cell = '';
      continue;
    }
    cell += ch;
  }
  out.push(cell);
  return out;
}

const root = path.join(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'tmp', 'RANCHO_20072026.csv'), 'utf8').split(/\r?\n/);
const headers = split(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
const cells = split(lines[2209]);
const row: Record<string, string> = {};
headers.forEach((h, i) => {
  row[h] = (cells[i] ?? '').trim();
});

const mapped = mapCsvRowToRegistrosGastos(row);
console.log(JSON.stringify(mapped, null, 2));
