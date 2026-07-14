/**
 * Parseo simple de CSV/TSV exportado desde Excel (tabla de compras históricas).
 * No depende de Gemini.
 */

export type FilaCsvCompra = {
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  date: string;
  descripcion: string;
  item_code: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  moneda: string;
};

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectSep(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis >= commas) return ';';
  return ',';
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function pickCol(headers: string[], aliases: string[]): number {
  const norms = headers.map(normHeader);
  for (const a of aliases) {
    const i = norms.indexOf(a);
    if (i >= 0) return i;
  }
  for (let i = 0; i < norms.length; i++) {
    const h = norms[i]!;
    if (aliases.some((a) => h.includes(a) || a.includes(h))) return i;
  }
  return -1;
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return (row[idx] ?? '').trim();
}

function parseNumCell(raw: string): number {
  const s = raw.replace(/\s/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizarFechaCsv(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1]!.padStart(2, '0');
    const mo = m[2]!.padStart(2, '0');
    let y = m[3]!;
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  // Excel serial date (días desde 1899-12-30) — aproximado
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const epoch = Date.UTC(1899, 11, 30) + serial * 86400000;
    const dt = new Date(epoch);
    const y = dt.getUTCFullYear();
    const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return '';
}

/**
 * Parsea texto CSV/TSV de Excel. Primera fila = encabezados.
 */
export function parseCsvTablaCompras(text: string): FilaCsvCompra[] {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('El CSV no tiene filas de datos. Exporte desde Excel con encabezados.');
  }

  const sep = detectSep(lines[0]!);
  const headers = splitCsvLine(lines[0]!, sep);

  const iFactura = pickCol(headers, [
    'invoice_number',
    'factura',
    'nro_factura',
    'numero_factura',
    'n_factura',
    'num_factura',
    'nro',
    'numero',
  ]);
  const iProveedor = pickCol(headers, [
    'supplier_name',
    'proveedor',
    'razon_social',
    'nombre_proveedor',
    'emisor',
  ]);
  const iRif = pickCol(headers, ['supplier_rif', 'rif', 'rif_proveedor', 'cedula_rif']);
  const iFecha = pickCol(headers, ['date', 'fecha', 'fecha_factura', 'f_emision']);
  const iDesc = pickCol(headers, [
    'descripcion',
    'description',
    'articulo',
    'concepto',
    'producto',
    'detalle',
  ]);
  const iCodigo = pickCol(headers, ['item_code', 'codigo', 'sku', 'cod', 'referencia']);
  const iUnidad = pickCol(headers, ['unidad', 'unit', 'und', 'um']);
  const iCant = pickCol(headers, ['cantidad', 'quantity', 'cant', 'qty']);
  const iPrecio = pickCol(headers, [
    'precio_unitario',
    'unit_price',
    'precio',
    'p_unitario',
    'pu',
  ]);
  const iSub = pickCol(headers, ['subtotal', 'total', 'monto', 'importe', 'total_linea']);
  const iMoneda = pickCol(headers, ['moneda', 'currency', 'divisa']);

  if (iFactura < 0 && iProveedor < 0 && iDesc < 0) {
    throw new Error(
      'No se reconocieron columnas. Incluya al menos: Factura, Proveedor o Descripción.',
    );
  }

  const filas: FilaCsvCompra[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]!, sep);
    if (cols.every((c) => !c.trim())) continue;

    const cantidad = parseNumCell(cell(cols, iCant)) || 1;
    const precio = parseNumCell(cell(cols, iPrecio));
    let subtotal = parseNumCell(cell(cols, iSub));
    if (!(subtotal > 0) && cantidad > 0 && precio >= 0) {
      subtotal = Math.round(cantidad * precio * 100) / 100;
    }

    const invoice = cell(cols, iFactura);
    const descripcion =
      cell(cols, iDesc) || (invoice ? `Compra factura ${invoice}` : '');
    if (!descripcion && !(subtotal > 0) && !invoice) continue;

    const monedaRaw = cell(cols, iMoneda).toUpperCase();
    const moneda =
      monedaRaw.includes('USD') || monedaRaw === '$' || monedaRaw.includes('DOL')
        ? 'USD'
        : 'VES';

    filas.push({
      invoice_number: invoice,
      supplier_name: cell(cols, iProveedor),
      supplier_rif: cell(cols, iRif),
      date: normalizarFechaCsv(cell(cols, iFecha)),
      descripcion: descripcion || 'Ítem',
      item_code: cell(cols, iCodigo),
      unidad: cell(cols, iUnidad) || 'UND',
      cantidad,
      precio_unitario: precio > 0 ? precio : subtotal > 0 ? subtotal / cantidad : 0,
      subtotal,
      moneda,
    });
  }

  if (filas.length === 0) {
    throw new Error('No se encontraron filas válidas en el CSV.');
  }
  return filas;
}

export function esArchivoCsvTabla(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith('.csv') ||
    n.endsWith('.tsv') ||
    n.endsWith('.txt') ||
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values' ||
    file.type === 'text/plain'
  );
}
