/**
 * Importación CSV diario (Antigravity / RANCHO) → `registros_gastos`.
 *
 * Estrategia: Reemplazo limpio transaccional (staging → TRUNCATE+INSERT en una TX).
 * Reimportar el mismo CSV deja el mismo número de filas (no duplica).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { TABLA_REGISTROS_GASTOS } from '@/lib/contabilidad/cco/registrosGastos';
import type { CreateGastoCcoInput } from '@/types/gastos';

const BATCH_SIZE = 250;
const STAGING_TABLE = 'registros_gastos_staging';

export type ImportCsvToSupabaseResult = {
  parsed: number;
  inserted: number;
  skipped: number;
  batches: number;
  /** Siempre true: el CSV diario reemplaza el libro completo. */
  replaced: boolean;
  /** total exacto en tabla tras el import (post-verificación). */
  totalEnTabla: number;
  mode: 'staging_commit' | 'direct_replace';
};

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
  if (nonEmpty.length < 2) return [];
  const headers = split(nonEmpty[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
  return nonEmpty.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

function pick(row: Record<string, string>, ...names: string[]): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase());
    if (k != null) return (row[k] ?? '').trim();
  }
  return '';
}

/** Limpia NaN / vacíos → null. */
function numClean(v: unknown): number | null {
  if (v == null || v === '') return null;
  const s = String(v).trim().replace(/,/g, '');
  if (!s || /^nan$/i.test(s) || s === 'None' || s === 'null') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function strClean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /^nan$/i.test(s) || s === 'None' || s === 'null') return null;
  return s;
}

/** Normaliza fechas a YYYY-MM-DD (ISO date). */
export function formatFechaCsv(v: unknown): string | null {
  const raw = strClean(v);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const m1 = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m1) {
    const d = Number(m1[1]);
    const mo = Number(m1[2]);
    const y = Number(m1[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const serial = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const epoch = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
    const dt = new Date(epoch);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/** Mapea una fila CSV (headers Antigravity) → fila snake_case de registros_gastos. */
export function mapCsvRowToRegistrosGastos(
  row: Record<string, string>,
): CreateGastoCcoInput | null {
  const clase = (strClean(pick(row, 'CLASE')) ?? 'GASTO').toUpperCase();
  const fecha = formatFechaCsv(pick(row, 'FECHA'));
  const descripcion = strClean(pick(row, 'DESCRIPCION', 'DESCRIPCIÓN'));
  const montoBase = numClean(pick(row, 'MONTO BASE USD', 'MONTO_BASE_USD', 'MONTO BASE'));
  const montoOrig = numClean(pick(row, 'MONTO ORIG', 'MONTO_ORIG', 'MONTO ORIGINAL'));
  const costoTotal = numClean(pick(row, 'COSTO TOTAL', 'COSTO_TOTAL'));
  const honorarios = numClean(pick(row, 'HONORARIOS'));

  if (!descripcion && montoBase == null && montoOrig == null && !fecha) {
    return null;
  }

  const pctAdmin = numClean(
    pick(row, '% ADMIN', 'PORCENTAJE_ADMIN', 'PORCENTAJE ADMIN', 'ADMIN'),
  );

  return {
    clase,
    fecha,
    proveedor: strClean(pick(row, 'PROVEEDOR')),
    tipo: strClean(pick(row, 'TIPO')),
    capitulo: strClean(pick(row, 'CAPITULO', 'CAPÍTULO')),
    subcapitulo: strClean(pick(row, 'SUBCAPITULO', 'SUBCAPÍTULO', 'SUB CAPITULO')),
    descripcion: descripcion ?? '—',
    contrato_vinculado: strClean(
      pick(row, 'CONTRATO_VINCULADO', 'CONTRATO VINCULADO', 'CONTRATO'),
    ),
    moneda: (strClean(pick(row, 'MONEDA')) ?? 'USD').toUpperCase(),
    tasa: numClean(pick(row, 'TASA')),
    monto_orig: montoOrig,
    monto_base_usd: montoBase,
    monto_pagado: numClean(pick(row, 'MONTO PAGADO', 'MONTO_PAGADO')),
    forma_pago: strClean(pick(row, 'FORMA PAGO', 'FORMA_PAGO')),
    link_factura: strClean(pick(row, 'LINK FACTURA', 'LINK_FACTURA', 'FACTURA')),
    link_comprobante: strClean(
      pick(row, 'LINK COMPROBANTE', 'LINK_COMPROBANTE', 'COMPROBANTE'),
    ),
    estado: strClean(pick(row, 'ESTADO')),
    honorarios,
    costo_total: costoTotal,
    porcentaje_admin: pctAdmin,
    tasa_binance: numClean(pick(row, 'TASA BINANCE', 'TASA_BINANCE')),
    tasa_usada: strClean(pick(row, 'TASA USADA', 'TASA_USADA')),
    porcentaje_brecha_real: numClean(
      pick(row, '% BRECHA REAL', 'PORCENTAJE_BRECHA_REAL', 'BRECHA REAL'),
    ),
    // En BD live `pool_asignado` es numeric; si viene texto no numérico → null.
    pool_asignado: numClean(pick(row, 'POOL ASIGNADO', 'POOL_ASIGNADO', 'POOL')),
    avance_fisico: numClean(pick(row, 'AVANCE_FISICO', 'AVANCE FISICO', 'AVANCE')),
  };
}

function toInsertRow(data: CreateGastoCcoInput): Record<string, unknown> {
  const clase = String(data.clase ?? 'GASTO').trim().toUpperCase() || 'GASTO';
  const montoBase = data.monto_base_usd ?? data.monto_orig ?? null;
  const pctAdmin = data.porcentaje_admin ?? 15;
  let honorarios = data.honorarios;
  if (honorarios == null && montoBase != null && clase === 'GASTO') {
    honorarios = Math.round(Number(montoBase) * (Number(pctAdmin) / 100) * 10000) / 10000;
  }
  let costoTotal = data.costo_total;
  if (costoTotal == null && montoBase != null) {
    costoTotal =
      clase === 'GASTO'
        ? Math.round((Number(montoBase) + Number(honorarios ?? 0)) * 100) / 100
        : Number(montoBase);
  }

  const fechaYmd = data.fecha ? formatFechaCsv(data.fecha) : null;
  const fecha = fechaYmd ? `${fechaYmd}T00:00:00Z` : null;

  return {
    clase,
    fecha,
    proveedor: data.proveedor ?? null,
    tipo: data.tipo ?? null,
    capitulo: data.capitulo ?? null,
    subcapitulo: data.subcapitulo ?? null,
    descripcion: data.descripcion ?? null,
    contrato_vinculado: data.contrato_vinculado ?? null,
    moneda: data.moneda ?? 'USD',
    tasa: data.tasa ?? null,
    monto_orig: data.monto_orig ?? null,
    monto_base_usd: montoBase,
    monto_pagado: data.monto_pagado ?? null,
    forma_pago: data.forma_pago ?? null,
    link_factura: data.link_factura ?? null,
    link_comprobante: data.link_comprobante ?? null,
    estado: data.estado ?? null,
    honorarios: honorarios ?? null,
    costo_total: costoTotal ?? null,
    porcentaje_admin: pctAdmin ?? null,
    tasa_binance: data.tasa_binance ?? null,
    tasa_usada: data.tasa_usada ?? null,
    porcentaje_brecha_real: data.porcentaje_brecha_real ?? null,
    pool_asignado: data.pool_asignado ?? null,
    avance_fisico: data.avance_fisico ?? null,
  };
}

/** Parsea texto CSV → filas listas para insert. */
export function parseRegistrosGastosCsv(csvText: string): {
  rows: Record<string, unknown>[];
  skipped: number;
} {
  const raw = parseCsvRows(csvText);
  if (!raw.length) {
    throw new Error('CSV vacío o sin filas de datos (¿falta encabezado?).');
  }

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const r of raw) {
    const mapped = mapCsvRowToRegistrosGastos(r);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    rows.push(toInsertRow(mapped));
  }
  return { rows, skipped };
}

export type ImportCsvOpts = {
  /**
   * @deprecated El CSV diario siempre hace reemplazo limpio (no append).
   * Se ignora para evitar duplicados al reimportar el acumulado.
   */
  replaceExisting?: boolean;
  batchSize?: number;
};

async function countRegistros(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from(TABLA_REGISTROS_GASTOS)
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(`No se pudo contar registros_gastos: ${error.message}`);
  return count ?? 0;
}

async function insertBatches(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  batchSize: number,
): Promise<number> {
  let batches = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(
        `Error en lote ${batches + 1} → ${table} (filas ${i + 1}–${i + chunk.length}): ${error.message}`,
      );
    }
    batches += 1;
  }
  return batches;
}

async function replaceViaStaging(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  batchSize: number,
): Promise<{ batches: number; inserted: number; totalEnTabla: number }> {
  const { error: clearErr } = await supabase.rpc('ci_clear_registros_gastos_staging');
  if (clearErr) throw new Error(clearErr.message);

  const batches = await insertBatches(supabase, STAGING_TABLE, rows, batchSize);

  const { data, error: commitErr } = await supabase.rpc('ci_commit_registros_gastos_from_staging');
  if (commitErr) throw new Error(commitErr.message);

  const payload = (data ?? {}) as { inserted?: number; total?: number };
  const inserted = Number(payload.inserted) || rows.length;
  const totalEnTabla = await countRegistros(supabase);

  if (totalEnTabla !== rows.length) {
    throw new Error(
      `Verificación fallida tras staging commit: esperaba ${rows.length} filas, hay ${totalEnTabla}.`,
    );
  }

  return {
    batches,
    inserted: Number(payload.total) || inserted,
    totalEnTabla,
  };
}

function shouldFallbackToDirectReplace(message: string): boolean {
  return /schema cache|does not exist|PGRST202|42P01|ci_clear_registros|ci_commit_registros|registros_gastos_staging|Could not find the function|staging|is of type numeric|is of type text|datatype mismatch/i.test(
    message,
  );
}

async function replaceDirect(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  batchSize: number,
): Promise<{ batches: number; inserted: number; totalEnTabla: number }> {
  // Fallback si aún no aplicaron migración 275: vaciar destino e insertar.
  const { error: delErr } = await supabase.from(TABLA_REGISTROS_GASTOS).delete().gte('id', 0);
  if (delErr) {
    const { error: del2 } = await supabase
      .from(TABLA_REGISTROS_GASTOS)
      .delete()
      .not('id', 'is', null);
    if (del2) throw new Error(`No se pudo vaciar registros_gastos: ${del2.message}`);
  }

  const afterDelete = await countRegistros(supabase);
  if (afterDelete !== 0) {
    throw new Error(
      `No se vació registros_gastos (quedan ${afterDelete} filas). Aplique migración 275 o revise RLS.`,
    );
  }

  const batches = await insertBatches(supabase, TABLA_REGISTROS_GASTOS, rows, batchSize);
  const totalEnTabla = await countRegistros(supabase);

  if (totalEnTabla !== rows.length) {
    throw new Error(
      `Verificación fallida tras replace directo: esperaba ${rows.length} filas, hay ${totalEnTabla}.`,
    );
  }

  return { batches, inserted: totalEnTabla, totalEnTabla };
}

/**
 * Reemplaza el contenido de `registros_gastos` con el CSV diario (acumulado).
 * Nunca hace append: subir el mismo archivo dos veces deja el mismo conteo.
 */
export async function importCsvToRegistrosGastos(
  supabase: SupabaseClient,
  csvText: string,
  opts?: ImportCsvOpts,
): Promise<ImportCsvToSupabaseResult> {
  const { rows, skipped } = parseRegistrosGastosCsv(csvText);
  if (!rows.length) {
    throw new Error('No hay filas válidas para importar.');
  }

  const batchSize = Math.min(Math.max(opts?.batchSize ?? BATCH_SIZE, 50), 500);

  try {
    const via = await replaceViaStaging(supabase, rows, batchSize);
    return {
      parsed: rows.length,
      inserted: via.inserted,
      skipped,
      batches: via.batches,
      replaced: true,
      totalEnTabla: via.totalEnTabla,
      mode: 'staging_commit',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!shouldFallbackToDirectReplace(msg)) {
      throw e instanceof Error ? e : new Error(msg);
    }
    // Limpia staging residual si el commit falló a mitad.
    await supabase.rpc('ci_clear_registros_gastos_staging').then(() => undefined, () => undefined);
  }

  const direct = await replaceDirect(supabase, rows, batchSize);
  return {
    parsed: rows.length,
    inserted: direct.inserted,
    skipped,
    batches: direct.batches,
    replaced: true,
    totalEnTabla: direct.totalEnTabla,
    mode: 'direct_replace',
  };
}
