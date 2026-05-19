export type PartidaLuloInsert = {
  proyecto_id: string;
  codigo_partida: string;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  precio_unitario_estimado: number;
  monto_total_estimado: number;
  origen: string;
};

function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** Parsea una línea CSV respetando comillas dobles. */
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

function parseCsvRecords(text: string, delimiter: ',' | ';'): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
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
  return rows;
}

function pickField(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim() !== '') return String(direct).trim();
    const lower = row[key.toLowerCase()];
    if (lower != null && String(lower).trim() !== '') return String(lower).trim();
  }
  return '';
}

function pickNumber(row: Record<string, string>, keys: string[]): number {
  const raw = pickField(row, keys).replace(/\s/g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function parsePresupuestoLuloCsv(text: string, proyectoId: string): PartidaLuloInsert[] {
  const delimiter = detectDelimiter(text);
  const records = parseCsvRecords(text, delimiter);
  const partidas: PartidaLuloInsert[] = [];

  for (const row of records) {
    const descripcion = pickField(row, ['descripcion', 'Descripcion', 'DESCRIPCION', 'desc']);
    const codigo = pickField(row, ['codigo_partida', 'Codigo', 'codigo', 'CODIGO', 'partida']);
    if (!descripcion && !codigo) continue;

    const cantidad = pickNumber(row, ['cantidad', 'Cantidad', 'cantidad_presupuestada', 'CANTIDAD']);
    const precio = pickNumber(row, [
      'precio_unitario',
      'Precio',
      'precio_unitario_estimado',
      'PRECIO',
      'precio',
    ]);
    const montoCsv = pickNumber(row, ['monto_total', 'Monto', 'monto_total_estimado', 'total']);
    const monto = montoCsv > 0 ? montoCsv : Math.round(cantidad * precio * 100) / 100;

    partidas.push({
      proyecto_id: proyectoId,
      codigo_partida: codigo,
      descripcion: descripcion || codigo,
      unidad: pickField(row, ['unidad', 'Unidad', 'UNIDAD']) || 'UND',
      cantidad_presupuestada: cantidad,
      precio_unitario_estimado: precio,
      monto_total_estimado: monto,
      origen: 'lulo_csv',
    });
  }

  return partidas;
}
