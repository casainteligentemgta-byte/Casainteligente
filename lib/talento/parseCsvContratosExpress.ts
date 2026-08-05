/**
 * Parseo de CSV/TSV/Excel para carga masiva de contratos express.
 *
 * Columnas canónicas:
 * nombres · apellidos · cedula · cargo · remuneracion_semanal · fecha_ingreso
 */

import * as XLSX from 'xlsx';

export type FilaCsvContratoExpress = {
  fila: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  cargo: string;
  remuneracion_semanal: number;
  fecha_ingreso: string;
};

export type ParseCsvExpressResult =
  | { ok: true; filas: FilaCsvContratoExpress[] }
  | { ok: false; error: string };

const ALIASES: Record<string, keyof Omit<FilaCsvContratoExpress, 'fila' | 'remuneracion_semanal'> | 'remuneracion'> = {
  nombres: 'nombres',
  nombre: 'nombres',
  'primer nombre': 'nombres',
  apellidos: 'apellidos',
  apellido: 'apellidos',
  cedula: 'cedula',
  cédula: 'cedula',
  ci: 'cedula',
  documento: 'cedula',
  cargo: 'cargo',
  oficio: 'cargo',
  cargo_nombre: 'cargo',
  remuneracion: 'remuneracion',
  remuneración: 'remuneracion',
  remuneracion_semanal: 'remuneracion',
  'remuneracion semanal': 'remuneracion',
  'remuneración semanal': 'remuneracion',
  sueldo_semanal: 'remuneracion',
  'sueldo semanal': 'remuneracion',
  pago_semanal: 'remuneracion',
  bono: 'remuneracion',
  bono_usd: 'remuneracion',
  fecha_ingreso: 'fecha_ingreso',
  'fecha de ingreso': 'fecha_ingreso',
  fecha: 'fecha_ingreso',
};

function normHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function splitLine(line: string, sep: string): string[] {
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
    if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectSep(headerLine: string): string {
  const sc = (headerLine.match(/;/g) ?? []).length;
  const cc = (headerLine.match(/,/g) ?? []).length;
  const tc = (headerLine.match(/\t/g) ?? []).length;
  if (tc >= sc && tc >= cc && tc > 0) return '\t';
  if (sc >= cc) return ';';
  return ',';
}

function parseNumero(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(/\$/g, '').replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Serial de fecha Excel (días desde 1899-12-30) → YYYY-MM-DD. */
function excelSerialToIso(serial: number): string {
  if (!Number.isFinite(serial) || serial < 1) return '';
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Convierte fechas Excel / texto comunes a YYYY-MM-DD. */
function normalizeFecha(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return excelSerialToIso(raw);
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const day = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const t = String(raw).trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  // Número serial como texto
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n > 20000 && n < 80000) return excelSerialToIso(n);
  }
  return t;
}

function cellToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Evitar notación científica en cédulas numéricas
    if (Number.isInteger(v) && Math.abs(v) >= 1e6) return String(Math.trunc(v));
    return String(v);
  }
  if (v instanceof Date) return normalizeFecha(v);
  return String(v).trim();
}

function filasDesdeMatriz(matrix: unknown[][], etiquetaArchivo: string): ParseCsvExpressResult {
  const rows = matrix.filter((r) => (r ?? []).some((c) => cellToString(c) !== ''));
  if (rows.length < 2) {
    return {
      ok: false,
      error: `El ${etiquetaArchivo} debe tener cabecera y al menos una fila de datos.`,
    };
  }

  const headers = (rows[0] ?? []).map((h) => normHeader(cellToString(h)));
  const colMap: Partial<Record<string, number>> = {};
  headers.forEach((h, i) => {
    const key = ALIASES[h];
    if (key) colMap[key] = i;
  });

  if (colMap.cedula == null || colMap.nombres == null || colMap.apellidos == null) {
    return {
      ok: false,
      error:
        'Cabecera inválida. Use: nombres, apellidos, cedula, cargo, remuneracion_semanal, fecha_ingreso.',
    };
  }

  const filas: FilaCsvContratoExpress[] = [];
  for (let li = 1; li < rows.length; li++) {
    const cells = rows[li] ?? [];
    const get = (k: string) => {
      const idx = colMap[k];
      if (idx == null) return '';
      return cellToString(cells[idx]);
    };
    const getRaw = (k: string) => {
      const idx = colMap[k];
      if (idx == null) return null;
      return cells[idx] ?? null;
    };

    const nombres = get('nombres');
    const apellidos = get('apellidos');
    let cedula = get('cedula');
    // Excel a veces deja la cédula como número sin V-
    if (cedula && /^\d+$/.test(cedula)) {
      cedula = `V-${cedula}`;
    }
    if (!cedula && !nombres && !apellidos) continue;

    const remRaw = getRaw('remuneracion');
    const remuneracion_semanal =
      typeof remRaw === 'number' && Number.isFinite(remRaw)
        ? Math.max(0, remRaw)
        : parseNumero(get('remuneracion'));

    filas.push({
      fila: li + 1,
      nombres,
      apellidos,
      cedula,
      cargo: get('cargo'),
      remuneracion_semanal,
      fecha_ingreso: normalizeFecha(getRaw('fecha_ingreso') ?? get('fecha_ingreso')),
    });
  }

  if (filas.length === 0) {
    return { ok: false, error: `No hay filas de datos en el ${etiquetaArchivo}.` };
  }

  return { ok: true, filas };
}

export function parseCsvContratosExpress(text: string): ParseCsvExpressResult {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!cleaned) return { ok: false, error: 'El archivo CSV está vacío.' };

  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: 'El CSV debe tener cabecera y al menos una fila de datos.' };
  }

  const sep = detectSep(lines[0]);
  const matrix = lines.map((line) => splitLine(line, sep));
  return filasDesdeMatriz(matrix, 'CSV');
}

export function parseXlsxContratosExpress(buffer: ArrayBuffer): ParseCsvExpressResult {
  try {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { ok: false, error: 'El Excel no tiene hojas.' };
    const sheet = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    }) as unknown[][];
    return filasDesdeMatriz(matrix, 'Excel');
  } catch (e) {
    console.error('[parseXlsxContratosExpress]', e);
    return { ok: false, error: 'No se pudo leer el archivo Excel (.xlsx / .xls).' };
  }
}

function esExcel(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) return true;
  const t = (file.type || '').toLowerCase();
  return (
    t.includes('spreadsheet') ||
    t.includes('excel') ||
    t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    t === 'application/vnd.ms-excel'
  );
}

/** Detecta CSV o Excel y parsea al mismo formato de filas. */
export async function parseArchivoContratosExpress(file: File): Promise<ParseCsvExpressResult> {
  if (esExcel(file)) {
    const buf = await file.arrayBuffer();
    return parseXlsxContratosExpress(buf);
  }
  const text = await file.text();
  return parseCsvContratosExpress(text);
}

export function descargarPlantillaXlsxContratosExpress(): void {
  const wb = XLSX.utils.book_new();
  const data = [
    ['nombres', 'apellidos', 'cedula', 'cargo', 'remuneracion_semanal', 'fecha_ingreso'],
    ['Juan Carlos', 'Pérez Gómez', 'V-12345678', 'Ayudante', 120, '2026-08-05'],
    ['María', 'Rodríguez', 'V-87654321', 'Oficial', 180, '2026-08-05'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
  XLSX.writeFile(wb, 'plantilla-contratos-express.xlsx');
}

export const PLANTILLA_CSV_CONTRATOS_EXPRESS =
  'nombres;apellidos;cedula;cargo;remuneracion_semanal;fecha_ingreso\n' +
  'Juan Carlos;Pérez Gómez;V-12345678;Ayudante;120;2026-08-05\n' +
  'María;Rodríguez;V-87654321;Oficial;180;2026-08-05\n';
