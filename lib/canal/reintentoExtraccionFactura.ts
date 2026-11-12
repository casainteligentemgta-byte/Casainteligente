import type { SupabaseClient } from '@supabase/supabase-js';
import { archivosPendienteCanal } from '@/lib/canal/documentPartsPendiente';

/** Primer intento + 2 reintentos automáticos con la foto ya guardada. */
export const MAX_INTENTOS_OCR = 3;

/** Espera antes del 2.º intento (corto) y del 3.º (mayor). El índice 0 no se usa. */
export const BACKOFF_MS_POR_REINTENTO = [0, 2_000, 8_000] as const;

/**
 * Si el OCR ya llevó demasiado tiempo, el 3.er intento se deja al cron
 * (`error_ocr` + `ocr_proximo_reintento_at`) para no superar el maxDuration.
 */
export const PRESUPUESTO_MS_IN_PROCESS = 90_000;

/** Misma ventana que el lock `procesando` abandonado. */
export const OCR_PROCESANDO_STALE_MS = 2 * 60 * 1000;

export const COLUMNA_OCR_INTENTOS = 'ocr_intentos';
export const COLUMNA_OCR_PROXIMO = 'ocr_proximo_reintento_at';

const COLUMNA_OCR_AUSENTE_RE =
  /ocr_intentos|ocr_proximo_reintento_at|PGRST204|schema cache/i;

export type FaseReintentoOcr = 'reintento' | 'diferir' | 'agotar';

export type ResultadoReintentoExtraccion<T> =
  | { ok: true; data: T; intentos: number }
  | {
      ok: false;
      error: string;
      intentos: number;
      diferido: boolean;
      transitorio: boolean;
    };

export function mensajeErrorExtraccion(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '');
  }
  return String(err ?? '');
}

export function statusErrorExtraccion(err: unknown): number | null {
  if (!err || typeof err !== 'object' || !('status' in err)) return null;
  const n = Number((err as { status?: unknown }).status);
  return Number.isFinite(n) ? n : null;
}

/**
 * Foto ilegible de verdad, documento que no es factura, o error de configuración.
 * No se reintenta: el cargador debe mandar otra foto.
 */
export function esErrorExtraccionNoTransitorio(err: unknown): boolean {
  const raw = mensajeErrorExtraccion(err);
  if (
    /falta una parte|totales no cuadran|sin total|album incompleto|álbum incompleto/i.test(
      raw,
    )
  ) {
    return true;
  }
  if (
    /foto más nítida|foto mas nitida|pdf con texto seleccionable|no es (una )?factura|no parece (una )?factura/i.test(
      raw,
    )
  ) {
    return true;
  }
  if (/GEMINI_API_KEY|clave GEMINI|inválida o sin permisos/i.test(raw)) {
    return true;
  }
  if (/supera el límite de 12 MB|no hay archivo para leer/i.test(raw)) return true;
  const status = statusErrorExtraccion(err);
  if (status === 401 || status === 403) return true;
  return false;
}

/**
 * Fallos de red/IA que en producción se arreglaron reprocesando la misma foto:
 * fetch failed, timeout/504/503/429, respuesta vacía o JSON inválido.
 */
export function esErrorExtraccionTransitorio(err: unknown): boolean {
  if (esErrorExtraccionNoTransitorio(err)) return false;

  if (err && typeof err === 'object' && (err as { retryable?: boolean }).retryable === true) {
    return true;
  }

  const status = statusErrorExtraccion(err);
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;

  const raw = mensajeErrorExtraccion(err);
  return /fetch failed|failed to fetch|timeout|timed out|etimedout|econnreset|econnrefused|enotfound|socket hang up|und_err|gateway timeout|\b504\b|\b503\b|\b429\b|\b502\b|overloaded|unavailable|saturado|quota|no devolvió datos|no devolvio datos|formato no válido|formato no valido|unexpected token|unexpected end/i.test(
    raw,
  );
}

export function payloadProgresoOcr(opts: {
  intentos: number;
  mensajeError: string;
  fase: FaseReintentoOcr;
  ahora?: Date;
  backoffDiferidoMs?: number;
}): Record<string, unknown> {
  const now = opts.ahora ?? new Date();
  const base: Record<string, unknown> = {
    [COLUMNA_OCR_INTENTOS]: opts.intentos,
    mensaje_error: opts.mensajeError.slice(0, 500),
    updated_at: now.toISOString(),
  };

  if (opts.fase === 'agotar') {
    return {
      ...base,
      estado: 'error',
      [COLUMNA_OCR_PROXIMO]: null,
    };
  }
  if (opts.fase === 'diferir') {
    const espera = opts.backoffDiferidoMs ?? BACKOFF_MS_POR_REINTENTO[2];
    return {
      ...base,
      estado: 'error_ocr',
      [COLUMNA_OCR_PROXIMO]: new Date(now.getTime() + espera).toISOString(),
    };
  }
  return {
    ...base,
    estado: 'procesando',
    [COLUMNA_OCR_PROXIMO]: null,
  };
}

export function columnasOcrDesconocidas(message: string | null | undefined): boolean {
  return COLUMNA_OCR_AUSENTE_RE.test(String(message ?? ''));
}

export async function persistirProgresoOcr(
  supabase: SupabaseClient,
  pendingId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update(payload)
    .eq('id', pendingId);
  if (!error) return;
  if (!columnasOcrDesconocidas(error.message)) {
    console.warn('[persistirProgresoOcr]', error.message);
    return;
  }
  const fallback = { ...payload };
  delete fallback[COLUMNA_OCR_INTENTOS];
  delete fallback[COLUMNA_OCR_PROXIMO];
  const retry = await supabase
    .from('ci_facturas_canal_pendientes')
    .update(fallback)
    .eq('id', pendingId);
  if (retry.error) {
    console.warn('[persistirProgresoOcr] fallback', retry.error.message);
  }
}

export async function leerOcrIntentos(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<number> {
  const sel = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('ocr_intentos, extracted')
    .eq('id', pendingId)
    .maybeSingle();
  if (sel.error && columnasOcrDesconocidas(sel.error.message)) {
    const retry = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('extracted')
      .eq('id', pendingId)
      .maybeSingle();
    return leerIntentosDesdeExtracted(retry.data?.extracted);
  }
  if (sel.error || !sel.data) return 0;
  const col = Number((sel.data as { ocr_intentos?: unknown }).ocr_intentos);
  if (Number.isFinite(col) && col > 0) return col;
  return leerIntentosDesdeExtracted((sel.data as { extracted?: unknown }).extracted);
}

function leerIntentosDesdeExtracted(extracted: unknown): number {
  if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) return 0;
  const n = Number((extracted as { reintentos?: unknown }).reintentos);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function extraerConReintentos<T>(opts: {
  extraer: () => Promise<T>;
  intentosPrevios?: number;
  maxIntentos?: number;
  backoffMs?: readonly number[];
  presupuestoMs?: number;
  startedAt?: number;
  ahora?: () => number;
  dormir?: (ms: number) => Promise<void>;
  onIntentoFallido?: (info: {
    intento: number;
    error: unknown;
    transitorio: boolean;
    diferir: boolean;
  }) => Promise<void>;
}): Promise<ResultadoReintentoExtraccion<T>> {
  const maxIntentos = opts.maxIntentos ?? MAX_INTENTOS_OCR;
  const backoffMs = opts.backoffMs ?? BACKOFF_MS_POR_REINTENTO;
  const presupuestoMs = opts.presupuestoMs ?? PRESUPUESTO_MS_IN_PROCESS;
  const ahora = opts.ahora ?? Date.now;
  const startedAt = opts.startedAt ?? ahora();
  const dormir =
    opts.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let intentos = Math.max(0, opts.intentosPrevios ?? 0);
  let lastError: unknown = new Error('Error OCR');

  while (intentos < maxIntentos) {
    const intento = intentos + 1;
    try {
      const data = await opts.extraer();
      return { ok: true, data, intentos: intento };
    } catch (e) {
      lastError = e;
      intentos = intento;
      const transitorio = esErrorExtraccionTransitorio(e);
      const quedan = intentos < maxIntentos;
      const elapsed = ahora() - startedAt;
      const diferir = Boolean(transitorio && quedan && elapsed >= presupuestoMs);
      if (opts.onIntentoFallido) {
        await opts.onIntentoFallido({ intento, error: e, transitorio, diferir });
      }
      if (!transitorio) {
        return {
          ok: false,
          error: mensajeErrorExtraccion(e),
          intentos,
          diferido: false,
          transitorio: false,
        };
      }
      if (!quedan) {
        return {
          ok: false,
          error: mensajeErrorExtraccion(e),
          intentos,
          diferido: false,
          transitorio: true,
        };
      }
      if (diferir) {
        return {
          ok: false,
          error: mensajeErrorExtraccion(e),
          intentos,
          diferido: true,
          transitorio: true,
        };
      }
      const wait = backoffMs[intento] ?? backoffMs[backoffMs.length - 1] ?? 8_000;
      if (wait > 0) await dormir(wait);
    }
  }

  return {
    ok: false,
    error: mensajeErrorExtraccion(lastError),
    intentos,
    diferido: false,
    transitorio: esErrorExtraccionTransitorio(lastError),
  };
}

export type FilaReintentoOcr = {
  id: string;
  estado: string;
  ocr_intentos?: number | null;
  ocr_proximo_reintento_at?: string | null;
  updated_at?: string | null;
  document_storage_path?: string | null;
  document_mime_type?: string | null;
  document_file_name?: string | null;
  document_parts?: unknown;
  canal?: string | null;
  chat_id?: string | null;
  mensaje_error?: string | null;
};

export function pendienteTieneArchivoOcr(row: {
  document_storage_path?: string | null;
  document_parts?: unknown;
}): boolean {
  if (String(row.document_storage_path ?? '').trim()) return true;
  return archivosPendienteCanal(row).length > 0;
}

export function esCandidatoReintentoOcr(
  row: FilaReintentoOcr,
  ahoraMs: number = Date.now(),
): boolean {
  const intentos = Number(row.ocr_intentos ?? 0);
  if (!Number.isFinite(intentos) || intentos <= 0 || intentos >= MAX_INTENTOS_OCR) {
    return false;
  }
  if (!pendienteTieneArchivoOcr(row)) return false;
  const estado = String(row.estado ?? '').toLowerCase();
  if (estado === 'error_ocr') {
    const proximo = Date.parse(String(row.ocr_proximo_reintento_at ?? ''));
    if (!Number.isFinite(proximo)) return true;
    return proximo <= ahoraMs;
  }
  if (estado === 'procesando') {
    const updated = Date.parse(String(row.updated_at ?? ''));
    if (!Number.isFinite(updated)) return true;
    return ahoraMs - updated >= OCR_PROCESANDO_STALE_MS;
  }
  return false;
}

export async function listarPendientesOcrReintento(
  supabase: SupabaseClient,
  opts?: { limite?: number; ahora?: Date },
): Promise<FilaReintentoOcr[]> {
  const limite = opts?.limite ?? 5;
  const ahoraMs = (opts?.ahora ?? new Date()).getTime();
  const sel = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(
      'id,estado,canal,chat_id,document_storage_path,document_mime_type,document_file_name,document_parts,ocr_intentos,ocr_proximo_reintento_at,updated_at,mensaje_error',
    )
    .in('estado', ['error_ocr', 'procesando'])
    .order('updated_at', { ascending: true })
    .limit(Math.max(limite * 4, 20));

  if (sel.error) {
    if (columnasOcrDesconocidas(sel.error.message)) return [];
    throw new Error(sel.error.message);
  }

  const rows = (sel.data ?? []) as FilaReintentoOcr[];
  return rows.filter((r) => esCandidatoReintentoOcr(r, ahoraMs)).slice(0, limite);
}

export async function reclamarReintentoOcr(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'procesando',
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId)
    .in('estado', ['error_ocr', 'procesando'])
    .select('id')
    .maybeSingle();
  if (error) {
    console.warn('[reclamarReintentoOcr]', error.message);
    return false;
  }
  return Boolean(data?.id);
}
