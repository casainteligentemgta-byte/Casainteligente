/**
 * Parser CSV maestro Streamlit (25 columnas) con comillas y números ES/VE.
 */
import { CSV_MAESTRO_COLUMNS } from '@/lib/contabilidad/cco/csvMaestroColumns';

/** Parsea número estilo VE/US: 647.265,00 · 647,265.00 · 22.561 · 22561,5 */
export function parseNumeroCsv(v: unknown): number | null {
  if (v == null || v === '') return null;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s || /^nan$/i.test(s) || s === 'None' || s === 'null') return null;

  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // VE: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // VE decimal: 1234,56
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitCsvLine(line: string): string[] {
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

/**
 * Divide el texto CSV en líneas físicas respetando campos entre comillas
 * (incluye saltos de línea dentro de celdas).
 * IMPORTANTE: conserva `"` en la línea para que splitCsvLine funcione.
 */
function splitCsvPhysicalLines(text: string): string[] {
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

/** Parsea CSV maestro → filas keyed por encabezado. */
export function parseCsvMaestroRows(text: string): Record<string, string>[] {
  const physical = splitCsvPhysicalLines(text);
  const nonEmpty = physical.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 2) return [];

  const headers = splitCsvLine(nonEmpty[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
  const expected = CSV_MAESTRO_COLUMNS.length;

  return nonEmpty.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    if (cells.length !== headers.length && cells.length !== expected) {
      row.__parse_warning = `columnas=${cells.length}, esperadas=${headers.length}`;
    }
    return row;
  });
}

export function round2HalfUp(n: number): number {
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(Number(n));
  const cents = Math.round((abs + Number.EPSILON) * 100) / 100;
  return sign * cents;
}

/**
 * Recalcula MONTO BASE USD / HONORARIOS / COSTO TOTAL como Streamlit V4.
 */
export function applyDerivedCsvMontos(
  input: {
    clase?: string | null;
    moneda?: string | null;
    monto_orig?: number | null;
    monto_base_usd?: number | null;
    honorarios?: number | null;
    costo_total?: number | null;
    porcentaje_admin?: number | null;
    tasa?: number | null;
  },
  adminDefault = 15,
): {
  monto_base_usd: number | null;
  honorarios: number | null;
  costo_total: number | null;
  porcentaje_admin: number | null;
} {
  const clase = String(input.clase ?? 'GASTO').trim().toUpperCase();
  const moneda = String(input.moneda ?? 'USD').trim().toUpperCase();
  const montoOrig = Number(input.monto_orig) || 0;
  const tasa = Number(input.tasa) || 0;
  let base: number | null = montoOrig;
  if (moneda && moneda !== 'USD' && montoOrig > 0 && tasa > 0) {
    base = montoOrig / tasa;
  } else if (!base) {
    base = Number(input.monto_base_usd) || 0;
  }
  base = base > 0 ? round2HalfUp(base) : null;

  let pct = Number(input.porcentaje_admin);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) pct = adminDefault;

  let honorarios = input.honorarios;
  let costoTotal = input.costo_total;

  if (clase === 'GASTO' && base != null) {
    honorarios = round2HalfUp(base * (pct / 100));
    costoTotal = round2HalfUp(base + honorarios);
  } else if (clase === 'INGRESO' && base != null) {
    honorarios = 0;
    costoTotal = base;
  }

  return {
    monto_base_usd: base,
    honorarios: honorarios ?? null,
    costo_total: costoTotal ?? null,
    porcentaje_admin: pct,
  };
}
