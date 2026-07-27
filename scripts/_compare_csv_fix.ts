import fs from 'fs';
import path from 'path';

function parseCsvRowsBuggy(text: string): Record<string, string>[] {
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
  return lines;
}

function parseCsvRowsFixed(text: string): string[] {
  const lines: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') {
        cur += '""';
        i++;
      } else {
        inQ = !inQ;
        cur += '"';
      }
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
  return lines;
}

const root = path.join(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'tmp', 'RANCHO_20072026.csv'), 'utf8');
const buggyLine = parseCsvRowsBuggy(csv)[2209];
const fixedLine = parseCsvRowsFixed(csv)[2209];
console.log('buggy has quotes', buggyLine.includes('"'));
console.log('fixed has quotes', fixedLine.includes('"'));
console.log('same', buggyLine === fixedLine);

function split(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '""') {
      // skip - handled below as two quotes
    }
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

console.log('buggy cells', split(buggyLine).length);
console.log('fixed cells', split(fixedLine).length);
