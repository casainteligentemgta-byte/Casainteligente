import { serializeLuloRow } from '@/lib/proyectos/luloSerialize';
import { assertMdbFileBuffer, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import { createMdbReader } from '@/lib/proyectos/loadMdbReader';

export type LuloMdbTableDump = {
  name: string;
  columns: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
};

export type LuloMdbFullDump = {
  formato: 'mdb';
  creationDate: string | null;
  tables: LuloMdbTableDump[];
};

export type LuloCsvFullDump = {
  formato: 'csv';
  delimiter: ',' | ';';
  headers: string[];
  rows: Record<string, string>[];
};

export function extractFullLuloMdb(buffer: Buffer | ArrayBuffer | Uint8Array): LuloMdbFullDump {
  const nodeBuffer = toMdbNodeBuffer(buffer);
  assertMdbFileBuffer(nodeBuffer);
  const reader = createMdbReader(nodeBuffer);
  const tableNames = reader.getTableNames({ normalTables: true, systemTables: false });
  const tables: LuloMdbTableDump[] = [];

  for (const name of tableNames) {
    if (name.startsWith('MSys')) continue;
    try {
      const table = reader.getTable(name);
      const columns = table.getColumnNames();
      const raw = table.getData() as Record<string, unknown>[];
      tables.push({
        name,
        columns,
        rowCount: raw.length,
        rows: raw.map(serializeLuloRow),
      });
    } catch {
      tables.push({ name, columns: [], rowCount: 0, rows: [] });
    }
  }

  return {
    formato: 'mdb',
    creationDate: reader.getCreationDate()?.toISOString() ?? null,
    tables,
  };
}

function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function extractFullLuloCsv(text: string): LuloCsvFullDump {
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 1) {
    return { formato: 'csv', delimiter, headers: [], rows: [] };
  }
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.replace(/^\uFEFF/, '').trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return { formato: 'csv', delimiter, headers, rows };
}
