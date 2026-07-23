/**
 * Importación CSV diario (Antigravity / RANCHO) → `registros_gastos`.
 *
 * Estrategia: Reemplazo limpio por obra (staging → DELETE obra + INSERT en una TX).
 * Reimportar el mismo CSV deja el mismo número de filas de esa obra (no duplica).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarClaseImport } from '@/lib/contabilidad/cco/csvMaestroColumns';
import {
  applyDerivedCsvMontos,
  parseCsvMaestroRows,
  parseNumeroCsv,
} from '@/lib/contabilidad/cco/parseCsvMaestro';
import { TABLA_REGISTROS_GASTOS } from '@/lib/contabilidad/cco/registrosGastos';
import type { CreateGastoCcoInput } from '@/types/gastos';

const BATCH_SIZE = 250;
const STAGING_TABLE = 'registros_gastos_staging';

export type ImportCsvToSupabaseResult = {
  parsed: number;
  inserted: number;
  skipped: number;
  batches: number;
  /** Siempre true: el CSV diario reemplaza el libro de la obra. */
  replaced: boolean;
  /** total exacto en tabla tras el import (post-verificación, de esa obra). */
  totalEnTabla: number;
  mode: 'staging_commit' | 'direct_replace';
  proyectoId: string;
  csvNombre?: string | null;
  csvImportadoAt?: string | null;
};

function parseCsvRows(text: string): Record<string, string>[] {
  return parseCsvMaestroRows(text);
}

function pick(row: Record<string, string>, ...names: string[]): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase());
    if (k != null) return (row[k] ?? '').trim();
  }
  return '';
}

/** Limpia NaN / vacíos → null (soporta 647.265,00 y 647,265.00). */
function numClean(v: unknown): number | null {
  return parseNumeroCsv(v);
}

function strClean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /^nan$/i.test(s) || s === 'None' || s === 'null') return null;
  return s;
}

/**
 * Normaliza fecha CSV → ISO para timestamptz.
 * Conserva hora/microsegundos cuando vienen en el CSV Streamlit.
 */
export function formatFechaCsv(v: unknown): string | null {
  const raw = strClean(v);
  if (!raw) return null;

  // Streamlit: 2026-02-13 00:00:00.000000
  const mStreamlit = raw.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/,
  );
  if (mStreamlit) {
    const micro = (mStreamlit[5] ?? '000000').padEnd(6, '0').slice(0, 6);
    return `${mStreamlit[1]}T${mStreamlit[2]}:${mStreamlit[3]}:${mStreamlit[4]}.${micro}Z`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00.000000Z`;

  const m1 = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m1) {
    const d = Number(m1[1]);
    const mo = Number(m1[2]);
    const y = Number(m1[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00.000000Z`;
    }
  }

  const serial = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const epoch = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
    const dt = new Date(epoch);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.toISOString().slice(0, 10)}T00:00:00.000000Z`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    // toISOString → ...sssZ ; ampliamos a microsegundos
    return parsed.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
  }

  return null;
}

/** Solo fecha YYYY-MM-DD (helpers UI). */
export function formatFechaCsvYmd(v: unknown): string | null {
  const iso = formatFechaCsv(v);
  return iso ? iso.slice(0, 10) : null;
}

/** Mapea una fila CSV (headers Antigravity) → fila snake_case de registros_gastos. */
export function mapCsvRowToRegistrosGastos(
  row: Record<string, string>,
): CreateGastoCcoInput | null {
  const clase = normalizarClaseImport(strClean(pick(row, 'CLASE')) ?? 'GASTO');
  const fecha = formatFechaCsvYmd(pick(row, 'FECHA'));
  const fechaFull = formatFechaCsv(pick(row, 'FECHA'));
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
    fecha: fechaFull ?? fecha,
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

function toInsertRow(
  data: CreateGastoCcoInput,
  proyectoId: string,
): Record<string, unknown> {
  const clase = normalizarClaseImport(String(data.clase ?? 'GASTO'));
  const derived = applyDerivedCsvMontos(
    {
      clase,
      moneda: data.moneda,
      monto_orig: data.monto_orig,
      monto_base_usd: data.monto_base_usd,
      honorarios: data.honorarios,
      costo_total: data.costo_total,
      porcentaje_admin: data.porcentaje_admin,
      tasa: data.tasa,
    },
    Number(data.porcentaje_admin) > 0 && Number(data.porcentaje_admin) <= 100
      ? Number(data.porcentaje_admin)
      : 15,
  );

  const montoBase = derived.monto_base_usd;
  const honorarios = derived.honorarios;
  const costoTotal = derived.costo_total;
  const pctAdmin = derived.porcentaje_admin;

  const fecha =
    data.fecha && String(data.fecha).includes('T')
      ? String(data.fecha)
      : data.fecha
        ? formatFechaCsv(data.fecha)
        : null;

  return {
    proyecto_id: proyectoId,
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
export function parseRegistrosGastosCsv(
  csvText: string,
  proyectoId: string,
): {
  rows: Record<string, unknown>[];
  skipped: number;
} {
  const raw = parseCsvRows(csvText);
  if (!raw.length) {
    throw new Error('CSV vacío o sin filas de datos (¿falta encabezado?).');
  }

  const pid = String(proyectoId || '').trim();
  if (!pid) throw new Error('proyecto_id requerido para importar CSV.');

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const r of raw) {
    const mapped = mapCsvRowToRegistrosGastos(r);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    rows.push(toInsertRow(mapped, pid));
  }
  return { rows, skipped };
}

export type ImportCsvOpts = {
  /** Obra dueña del libro (obligatorio). */
  proyectoId: string;
  /** Nombre del archivo CSV (se guarda en cco_proyecto_config.metadata). */
  csvFileName?: string | null;
  /**
   * @deprecated El CSV diario siempre hace reemplazo limpio por obra (no append).
   */
  replaceExisting?: boolean;
  batchSize?: number;
};

async function countRegistros(
  supabase: SupabaseClient,
  proyectoId?: string | null,
): Promise<number> {
  let q = supabase.from(TABLA_REGISTROS_GASTOS).select('id', { count: 'exact', head: true });
  if (proyectoId) q = q.eq('proyecto_id', proyectoId);
  const { count, error } = await q;
  if (error) {
    if (proyectoId && /proyecto_id|42703/i.test(error.message)) {
      return countRegistros(supabase, null);
    }
    throw new Error(`No se pudo contar registros_gastos: ${error.message}`);
  }
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
      // Fallback: staging sin columna proyecto_id aún
      if (/proyecto_id|42703/i.test(error.message)) {
        const stripped = chunk.map(({ proyecto_id: _p, ...rest }) => rest);
        const { error: e2 } = await supabase.from(table).insert(stripped);
        if (e2) {
          throw new Error(
            `Error en lote ${batches + 1} → ${table} (filas ${i + 1}–${i + chunk.length}): ${e2.message}`,
          );
        }
      } else {
        throw new Error(
          `Error en lote ${batches + 1} → ${table} (filas ${i + 1}–${i + chunk.length}): ${error.message}`,
        );
      }
    }
    batches += 1;
  }
  return batches;
}

async function replaceViaStaging(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  batchSize: number,
  proyectoId: string,
): Promise<{ batches: number; inserted: number; totalEnTabla: number }> {
  const { error: clearErr } = await supabase.rpc('ci_clear_registros_gastos_staging');
  if (clearErr) throw new Error(clearErr.message);

  const batches = await insertBatches(supabase, STAGING_TABLE, rows, batchSize);

  const { data, error: commitErr } = await supabase.rpc(
    'ci_commit_registros_gastos_from_staging',
    { p_proyecto_id: proyectoId },
  );
  if (commitErr) throw new Error(commitErr.message);

  const payload = (data ?? {}) as { inserted?: number; total?: number };
  const inserted = Number(payload.inserted) || rows.length;
  const totalEnTabla = await countRegistros(supabase, proyectoId);

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
  return /schema cache|does not exist|PGRST202|42P01|ci_clear_registros|ci_commit_registros|registros_gastos_staging|Could not find the function|staging|is of type numeric|is of type text|datatype mismatch|proyecto_id requerido|replace global/i.test(
    message,
  );
}

async function replaceDirect(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  batchSize: number,
  proyectoId: string,
): Promise<{ batches: number; inserted: number; totalEnTabla: number }> {
  // Preferir borrar solo la obra; si no hay columna, vaciar todo (legacy).
  let delErrMsg: string | null = null;
  {
    const { error: delErr } = await supabase
      .from(TABLA_REGISTROS_GASTOS)
      .delete()
      .eq('proyecto_id', proyectoId);
    if (delErr) delErrMsg = delErr.message;
  }

  if (delErrMsg && /proyecto_id|42703/i.test(delErrMsg)) {
    const { error: delErr } = await supabase.from(TABLA_REGISTROS_GASTOS).delete().gte('id', 0);
    if (delErr) {
      const { error: del2 } = await supabase
        .from(TABLA_REGISTROS_GASTOS)
        .delete()
        .not('id', 'is', null);
      if (del2) throw new Error(`No se pudo vaciar registros_gastos: ${del2.message}`);
    }
  } else if (delErrMsg) {
    throw new Error(`No se pudo vaciar registros_gastos de la obra: ${delErrMsg}`);
  }

  const stillMine = await countRegistros(supabase, proyectoId);
  if (stillMine !== 0) {
    throw new Error(
      `No se vació registros_gastos de la obra (quedan ${stillMine} filas). Aplique migración 278 o revise RLS.`,
    );
  }

  const batches = await insertBatches(supabase, TABLA_REGISTROS_GASTOS, rows, batchSize);
  const totalEnTabla = await countRegistros(supabase, proyectoId);

  if (totalEnTabla !== rows.length) {
    throw new Error(
      `Verificación fallida tras replace directo: esperaba ${rows.length} filas, hay ${totalEnTabla}.`,
    );
  }

  return { batches, inserted: totalEnTabla, totalEnTabla };
}

/**
 * Reemplaza el libro CSV de una obra en `registros_gastos`.
 * Nunca hace append: subir el mismo archivo dos veces deja el mismo conteo de esa obra.
 */
export async function importCsvToRegistrosGastos(
  supabase: SupabaseClient,
  csvText: string,
  opts: ImportCsvOpts,
): Promise<ImportCsvToSupabaseResult> {
  const proyectoId = String(opts?.proyectoId ?? '').trim();
  if (!proyectoId) {
    throw new Error('proyecto_id requerido: selecciona la obra antes de importar el CSV diario.');
  }

  const { rows, skipped } = parseRegistrosGastosCsv(csvText, proyectoId);
  if (!rows.length) {
    throw new Error('No hay filas válidas para importar.');
  }

  const batchSize = Math.min(Math.max(opts?.batchSize ?? BATCH_SIZE, 50), 500);

  let base: Omit<ImportCsvToSupabaseResult, 'csvNombre' | 'csvImportadoAt'>;
  try {
    const via = await replaceViaStaging(supabase, rows, batchSize, proyectoId);
    base = {
      parsed: rows.length,
      inserted: via.inserted,
      skipped,
      batches: via.batches,
      replaced: true,
      totalEnTabla: via.totalEnTabla,
      mode: 'staging_commit',
      proyectoId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!shouldFallbackToDirectReplace(msg)) {
      throw e instanceof Error ? e : new Error(msg);
    }
    // Limpia staging residual si el commit falló a mitad.
    await supabase.rpc('ci_clear_registros_gastos_staging').then(() => undefined, () => undefined);
    const direct = await replaceDirect(supabase, rows, batchSize, proyectoId);
    base = {
      parsed: rows.length,
      inserted: direct.inserted,
      skipped,
      batches: direct.batches,
      replaced: true,
      totalEnTabla: direct.totalEnTabla,
      mode: 'direct_replace',
      proyectoId,
    };
  }

  const csvFileName = String(opts.csvFileName ?? '').trim();
  if (csvFileName) {
    try {
      const { guardarCsvFuenteCco } = await import('@/lib/contabilidad/cco/proyectoConfig');
      const saved = await guardarCsvFuenteCco(supabase, proyectoId, csvFileName);
      return {
        ...base,
        csvNombre: saved.csv_nombre,
        csvImportadoAt: saved.csv_importado_at,
      };
    } catch {
      return { ...base, csvNombre: csvFileName, csvImportadoAt: null };
    }
  }

  return base;
}
