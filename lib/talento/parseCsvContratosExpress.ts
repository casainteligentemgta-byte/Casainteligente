/**
 * Parseo ligero de CSV/TSV para carga masiva de contratos express (sin papaparse).
 * Separador: `;` o `,` (detectado por cabecera). Excel VE suele exportar con `;`.
 *
 * Columnas canónicas:
 * nombres · apellidos · cedula · cargo · remuneracion_semanal · fecha_ingreso
 */

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

/** Convierte fechas Excel comunes a YYYY-MM-DD. */
function normalizeFecha(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  return t;
}

export function parseCsvContratosExpress(text: string): ParseCsvExpressResult {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!cleaned) return { ok: false, error: 'El archivo CSV está vacío.' };

  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: 'El CSV debe tener cabecera y al menos una fila de datos.' };
  }

  const sep = detectSep(lines[0]);
  const headers = splitLine(lines[0], sep).map(normHeader);
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
  for (let li = 1; li < lines.length; li++) {
    const cells = splitLine(lines[li], sep);
    const get = (k: string) => {
      const idx = colMap[k];
      if (idx == null) return '';
      return (cells[idx] ?? '').trim();
    };
    const nombres = get('nombres');
    const apellidos = get('apellidos');
    const cedula = get('cedula');
    if (!cedula && !nombres && !apellidos) continue;

    filas.push({
      fila: li + 1,
      nombres,
      apellidos,
      cedula,
      cargo: get('cargo'),
      remuneracion_semanal: parseNumero(get('remuneracion')),
      fecha_ingreso: normalizeFecha(get('fecha_ingreso')),
    });
  }

  if (filas.length === 0) {
    return { ok: false, error: 'No hay filas de datos en el CSV.' };
  }

  return { ok: true, filas };
}

export const PLANTILLA_CSV_CONTRATOS_EXPRESS =
  'nombres;apellidos;cedula;cargo;remuneracion_semanal;fecha_ingreso\n' +
  'Juan Carlos;Pérez Gómez;V-12345678;Ayudante;120;2026-08-05\n' +
  'María;Rodríguez;V-87654321;Oficial;180;2026-08-05\n';
