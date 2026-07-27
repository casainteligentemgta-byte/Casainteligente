import fs from 'fs';
import path from 'path';
import { parseRegistrosGastosCsv } from '../lib/contabilidad/cco/importCsvToRegistrosGastos';

// inline parseCsvRows copy - add logging
function parseCsvRows(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      lines.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.length) lines.push(cur);

  const split = (line: string): string[] => {
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
  };

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const headers = split(nonEmpty[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
  return nonEmpty.slice(1).map((line, idx) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    if (line.includes('CONCRETO ABONO')) {
      console.log('FOUND at raw index', idx + 1, 'cells', cells.length);
      headers.forEach((h, i) => console.log(' ', h, JSON.stringify(cells[i] ?? '')));
    }
    return row;
  });
}

const root = path.join(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'tmp', 'RANCHO_20072026.csv'), 'utf8');
parseCsvRows(csv);
