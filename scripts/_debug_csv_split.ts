import fs from 'fs';
import path from 'path';

// copy split logic from importCsvToRegistrosGastos
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
const headers = split(lines[0]);
const line = lines[2209];
const cells = split(line);
console.log('header count', headers.length, 'cell count', cells.length);
headers.forEach((h, i) => {
  console.log(i + 1, h, '=>', JSON.stringify(cells[i] ?? ''));
});
