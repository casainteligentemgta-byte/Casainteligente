/**
 * Parseo de CSV/TSV/Excel para carga masiva de contratos express.
 *
 * Columnas canónicas (plantilla):
 * nombres · apellidos · cedula · cargo · remuneracion_semanal · fecha_ingreso
 *
 * También acepta listados de personal / nómina de obra:
 * N°, NOMBRES Y APELLIDOS, C.I., FECHA INI, CARGO, …
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
  /** Nivel genérico del listado (1–9), si viene en el Excel. */
  nivel_generico: number | null;
};

export type ParseCsvExpressResult =
  | { ok: true; filas: FilaCsvContratoExpress[] }
  | { ok: false; error: string };

type ColKey =
  | 'nombres'
  | 'apellidos'
  | 'nombre_completo'
  | 'cedula'
  | 'cargo'
  | 'remuneracion'
  | 'fecha_ingreso'
  | 'nivel_generico';

/** Normaliza encabezado: minúsculas, sin acentos, puntuación → espacio. */
function normHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveAlias(norm: string): ColKey | null {
  if (!norm) return null;

  // Cédula: C.I., C I, nro ci, cedula, documento…
  if (
    /^(c i|ci|nro c i|n c i|nro ci|numero ci|cedula|cedula identidad|cedula de identidad|documento|doc|identidad)$/.test(
      norm,
    ) ||
    (/^(c i|ci|cedula|documento)/.test(norm) && !/cuenta|banco|cargo/.test(norm))
  ) {
    return 'cedula';
  }

  // Nombre completo (listado de obra)
  if (
    /(nombres?\s+y\s+apellidos?|apellidos?\s+y\s+nombres?|nombre\s+completo|nombre\s+y\s+apellido|full name)/.test(
      norm,
    ) ||
    (norm.includes('nombre') && norm.includes('apellido'))
  ) {
    return 'nombre_completo';
  }

  if (/^(nombres|nombre|primer nombre|name)$/.test(norm)) return 'nombres';
  if (/^(apellidos|apellido|surname)$/.test(norm)) return 'apellidos';

  if (/^(cargo|oficio|cargo nombre|tabulador|puesto)$/.test(norm) || norm.startsWith('cargo ')) {
    return 'cargo';
  }

  if (
    /remuneracion|sueldo semanal|pago semanal|canon semanal|^canon$|^bono$|bono usd|bono manual/.test(
      norm,
    )
  ) {
    return 'remuneracion';
  }

  // Fecha: fecha ingreso, fecha ini, fecha inicio, FECHA INI…
  if (
    /^fecha( de)? (ingreso|ini|inicio|firma)?$/.test(norm) ||
    (norm.includes('fecha') && (norm.includes('ingreso') || /\bini/.test(norm) || norm.includes('inicio')))
  ) {
    return 'fecha_ingreso';
  }
  if (norm === 'fecha') return 'fecha_ingreso';

  if (
    /^(nivel generico|nivel|nivel salarial|nivel gen)$/.test(norm) ||
    (norm.includes('nivel') && (norm.includes('generico') || norm.includes('salarial')))
  ) {
    return 'nivel_generico';
  }

  return null;
}

/** Parte «Nombres y Apellidos» en dos campos (heurística VE). */
export function partirNombreCompleto(completo: string): { nombres: string; apellidos: string } {
  const parts = completo
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { nombres: '', apellidos: '' };
  if (parts.length === 1) return { nombres: parts[0]!, apellidos: '' };
  if (parts.length === 2) return { nombres: parts[0]!, apellidos: parts[1]! };
  if (parts.length === 3) {
    return { nombres: parts[0]!, apellidos: `${parts[1]} ${parts[2]}` };
  }
  // 4+: dos nombres + resto apellidos
  return {
    nombres: `${parts[0]} ${parts[1]}`,
    apellidos: parts.slice(2).join(' '),
  };
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

/** Convierte fechas Excel / texto comunes a YYYY-MM-DD (acepta 3/6/24). */
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
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1]!.padStart(2, '0');
    const mo = m[2]!.padStart(2, '0');
    let y = m[3]!;
    if (y.length === 2) y = Number(y) >= 70 ? `19${y}` : `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n > 20000 && n < 80000) return excelSerialToIso(n);
  }
  return t;
}

function cellToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) >= 1e6) return String(Math.trunc(v));
    return String(v);
  }
  if (v instanceof Date) return normalizeFecha(v);
  return String(v).trim();
}

function scoreHeaderRow(cells: unknown[]): { score: number; colMap: Partial<Record<ColKey, number>> } {
  const colMap: Partial<Record<ColKey, number>> = {};
  let score = 0;
  (cells ?? []).forEach((c, i) => {
    const key = resolveAlias(normHeader(cellToString(c)));
    if (!key) return;
    if (colMap[key] == null) {
      colMap[key] = i;
      score += key === 'cedula' || key === 'nombre_completo' || key === 'nombres' ? 3 : 1;
    }
  });
  return { score, colMap };
}

/** Busca la fila de encabezados (tolera título «LISTADO DEL PERSONAL…» arriba). */
function localizarCabecera(rows: unknown[][]): {
  headerIdx: number;
  colMap: Partial<Record<ColKey, number>>;
} | null {
  const maxScan = Math.min(rows.length, 20);
  let best: { headerIdx: number; score: number; colMap: Partial<Record<ColKey, number>> } | null =
    null;
  for (let i = 0; i < maxScan; i++) {
    const { score, colMap } = scoreHeaderRow(rows[i] ?? []);
    const tieneCedula = colMap.cedula != null;
    const tieneNombre =
      colMap.nombre_completo != null || (colMap.nombres != null && colMap.apellidos != null);
    if (!tieneCedula || !tieneNombre) continue;
    if (!best || score > best.score) {
      best = { headerIdx: i, score, colMap };
    }
  }
  return best ? { headerIdx: best.headerIdx, colMap: best.colMap } : null;
}

function filasDesdeMatriz(matrix: unknown[][], etiquetaArchivo: string): ParseCsvExpressResult {
  const rows = matrix.filter((r) => (r ?? []).some((c) => cellToString(c) !== ''));
  if (rows.length < 2) {
    return {
      ok: false,
      error: `El ${etiquetaArchivo} debe tener cabecera y al menos una fila de datos.`,
    };
  }

  const cab = localizarCabecera(rows);
  if (!cab) {
    return {
      ok: false,
      error:
        'Cabecera inválida. Use: nombres, apellidos, cedula, cargo, remuneracion_semanal, fecha_ingreso — o un listado con NOMBRES Y APELLIDOS, C.I., FECHA INI, CARGO.',
    };
  }

  const { headerIdx, colMap } = cab;
  const filas: FilaCsvContratoExpress[] = [];

  for (let li = headerIdx + 1; li < rows.length; li++) {
    const cells = rows[li] ?? [];
    const get = (k: ColKey) => {
      const idx = colMap[k];
      if (idx == null) return '';
      return cellToString(cells[idx]);
    };
    const getRaw = (k: ColKey) => {
      const idx = colMap[k];
      if (idx == null) return null;
      return cells[idx] ?? null;
    };

    let nombres = get('nombres');
    let apellidos = get('apellidos');
    const completo = get('nombre_completo');
    if ((!nombres || !apellidos) && completo) {
      const p = partirNombreCompleto(completo);
      if (!nombres) nombres = p.nombres;
      if (!apellidos) apellidos = p.apellidos;
    }

    let cedula = get('cedula');
    // Fila de encabezado repetida / título
    if (/^(c\.?i\.?|cedula|cédula|n°|nro)$/i.test(cedula) || /^nombres?\s*y\s*apellidos?/i.test(completo || nombres)) {
      continue;
    }
    if (cedula && /^\d+$/.test(cedula)) {
      cedula = `V-${cedula}`;
    }
    // Cédulas con puntos: 10.199.713
    if (cedula && /^\d{1,3}(\.\d{3})+$/.test(cedula)) {
      cedula = `V-${cedula.replace(/\./g, '')}`;
    }
    if (!cedula && !nombres && !apellidos && !completo) continue;
    if (!cedula) continue;

    const remRaw = getRaw('remuneracion');
    const remuneracion_semanal =
      typeof remRaw === 'number' && Number.isFinite(remRaw)
        ? Math.max(0, remRaw)
        : parseNumero(get('remuneracion'));

    const nivelRaw = getRaw('nivel_generico');
    let nivel_generico: number | null = null;
    if (typeof nivelRaw === 'number' && Number.isFinite(nivelRaw)) {
      const n = Math.round(nivelRaw);
      if (n >= 1 && n <= 9) nivel_generico = n;
    } else {
      const n = Math.round(parseNumero(get('nivel_generico')));
      if (n >= 1 && n <= 9) nivel_generico = n;
    }

    filas.push({
      fila: li + 1,
      nombres,
      apellidos,
      cedula,
      cargo: get('cargo'),
      remuneracion_semanal,
      fecha_ingreso: normalizeFecha(getRaw('fecha_ingreso') ?? get('fecha_ingreso')),
      nivel_generico,
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
  // Si la 1ª fila es título, el separador de la cabecera real puede diferir; re-detectar tras localizar.
  let matrix = lines.map((line) => splitLine(line, sep));
  // Reintento con sep de la fila de cabecera si score falla
  const firstTry = filasDesdeMatriz(matrix, 'CSV');
  if (firstTry.ok) return firstTry;

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const sep2 = detectSep(lines[i]!);
    if (sep2 === sep) continue;
    matrix = lines.map((line) => splitLine(line, sep2));
    const retry = filasDesdeMatriz(matrix, 'CSV');
    if (retry.ok) return retry;
  }
  return firstTry;
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
