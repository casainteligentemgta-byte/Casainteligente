import type { SupabaseClient } from '@supabase/supabase-js';
import { obtenerTasaBcvConfigNominaGlobal } from '@/lib/contabilidad/tasaBcvConfigNomina';
import {
  FUENTE_BCV_OFICIAL,
  estadoTasaParaFechaSolicitada,
  hoyIsoCaracas,
} from '@/lib/finanzas/bcvOficial';
import { tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import { outboundFetch } from '@/lib/network/outboundFetch';

export { calcularGastoBimonetario, montoUsdAVes, montoVesAUsd } from '@/lib/finanzas/currency-converter';
export type { BimonetarioResult, MonedaOrigen } from '@/lib/finanzas/currency-converter';

const BCV_HISTORY_URL = 'https://bcv.today/api/v1/history';
const BCV_RAFNIXG_URL = 'https://bcv-api.rafnixg.dev/rates';
const BCV_FETCH_TIMEOUT_MS = 8_000;

const tasaCache = new Map<string, { result: TasaBcvResult; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_TTL_DESACTUALIZADA_MS = 15 * 60 * 1000;

export type FuenteTasaBcv =
  | typeof FUENTE_BCV_OFICIAL
  | 'bcv.today'
  | 'bcv.today_actual'
  | 'bcv.rafnixg'
  | 'ci_config_nomina'
  | 'env';

/** `actualizada` = vigente para la fecha pedida (mismo día, fin de semana o feriado). */
export type EstadoTasaBcv = 'actualizada' | 'desactualizada';

export type TasaBcvResult = {
  fecha: string;
  tasa_bcv_ves_por_usd: number;
  fuente: FuenteTasaBcv | string;
  fecha_valor?: string | null;
  estado: EstadoTasaBcv;
};

export type OpcionesTasaBcv = {
  supabase?: SupabaseClient;
  /** Tests: no pegarle a BCV ni a agregadores. */
  skipLive?: boolean;
};

export type FilaTasaBcv = {
  fecha: string;
  usd: number;
  fuente: string;
  fecha_valor: string | null;
};

function normalizarFechaIso(fecha: string): string {
  const s = fecha.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return hoyIsoCaracas();
  }
  return s;
}

function numeroTasaPositivo(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fechaDesdePayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  for (const key of ['date', 'fecha', 'fecha_valor', 'fechaValor', 'last_update', 'datetime']) {
    const raw = o[key];
    if (typeof raw === 'string') {
      const iso = raw.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
  }
  if (o.data && typeof o.data === 'object') return fechaDesdePayload(o.data);
  return null;
}

/** Interpreta respuestas de bcv.today, rafnixg y APIs similares. */
function tasaDesdePayload(data: unknown, depth = 0): number | null {
  if (!data || typeof data !== 'object' || depth > 4) return null;
  const o = data as Record<string, unknown>;

  const directUsd = numeroTasaPositivo(o.USD ?? o.usd);
  if (directUsd) return directUsd;

  for (const key of ['rate', 'dollar', 'monto', 'valor', 'tasa', 'value', 'price']) {
    const v = o[key];
    if (typeof v === 'object' && v !== null) {
      const nested = tasaDesdePayload(v, depth + 1);
      if (nested) return nested;
    }
    const n = numeroTasaPositivo(v);
    if (n) return n;
  }

  const rates = o.rates;
  if (rates && typeof rates === 'object') {
    const usdNode = (rates as Record<string, unknown>).USD;
    if (usdNode && typeof usdNode === 'object') {
      const nested = tasaDesdePayload(usdNode, depth + 1);
      if (nested) return nested;
    }
    const flatUsd = numeroTasaPositivo(usdNode);
    if (flatUsd) return flatUsd;
  }

  if (o.data && typeof o.data === 'object') {
    const nested = tasaDesdePayload(o.data, depth + 1);
    if (nested) return nested;
  }

  return null;
}

export function vaciarCacheTasaBcv(): void {
  tasaCache.clear();
}

function guardarTasaEnCache(iso: string, result: TasaBcvResult): TasaBcvResult {
  tasaCache.set(iso, { result, at: Date.now() });
  return result;
}

function cacheVigente(iso: string): TasaBcvResult | null {
  const cached = tasaCache.get(iso);
  if (!cached) return null;
  const ttl = cached.result.estado === 'desactualizada' ? CACHE_TTL_DESACTUALIZADA_MS : CACHE_TTL_MS;
  if (Date.now() - cached.at >= ttl) return null;
  return cached.result;
}

async function fetchBcvJson(url: string, context: string): Promise<unknown | null> {
  try {
    const res = await outboundFetch(
      url,
      {
        method: 'GET',
        signal: AbortSignal.timeout(BCV_FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      },
      context,
    );
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function fechaValorDeFila(fila: FilaTasaBcv): string {
  return fila.fecha_valor ?? fila.fecha;
}

/** El BCV publica a veces la Fecha Valor del próximo hábil: no aplica a un día anterior. */
function filaAplicaAFecha(fila: FilaTasaBcv, iso: string): boolean {
  return fechaValorDeFila(fila) <= iso;
}

function resultadoDeFila(iso: string, fila: FilaTasaBcv): TasaBcvResult {
  const fechaValor = fechaValorDeFila(fila);
  return {
    fecha: iso,
    tasa_bcv_ves_por_usd: fila.usd,
    fuente: fila.fuente,
    fecha_valor: fechaValor,
    estado: estadoTasaParaFechaSolicitada(iso, fechaValor),
  };
}

function mapFila(row: Record<string, unknown> | null | undefined): FilaTasaBcv | null {
  if (!row) return null;
  const usd = Number(row.usd);
  const fecha = String(row.fecha ?? '').slice(0, 10);
  if (!fecha || !Number.isFinite(usd) || usd <= 0) return null;
  return {
    fecha,
    usd,
    fuente: String(row.fuente ?? ''),
    fecha_valor: row.fecha_valor ? String(row.fecha_valor).slice(0, 10) : null,
  };
}

function tablaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /ci_tasas_bcv/i.test(error.message ?? '');
}

export async function leerTasaBcvPorFecha(
  supabase: SupabaseClient,
  fecha: string,
): Promise<FilaTasaBcv | null> {
  const { data, error } = await supabase
    .from('ci_tasas_bcv')
    .select('fecha, usd, fuente, fecha_valor')
    .eq('fecha', fecha)
    .maybeSingle();
  if (error) {
    if (tablaAusente(error)) return null;
    throw new Error(error.message);
  }
  return mapFila(data as Record<string, unknown> | null);
}

export async function leerTasaBcvAnterior(
  supabase: SupabaseClient,
  fecha: string,
): Promise<FilaTasaBcv | null> {
  const { data, error } = await supabase
    .from('ci_tasas_bcv')
    .select('fecha, usd, fuente, fecha_valor')
    .lt('fecha', fecha)
    .order('fecha', { ascending: false })
    .limit(15);
  if (error) {
    if (tablaAusente(error)) return null;
    throw new Error(error.message);
  }
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const mapped = mapFila(row as Record<string, unknown>);
    if (mapped && filaAplicaAFecha(mapped, fecha)) return mapped;
  }
  return null;
}

/**
 * Agregadores solo por URL de historial de esa fecha.
 * No usa el endpoint «actual»: ese era el bug (tasa del 4 nov como si fuera hoy).
 */
export async function tasaDesdeAgregadorPorFecha(iso: string): Promise<TasaBcvResult | null> {
  const history = await fetchBcvJson(`${BCV_HISTORY_URL}/${iso}.json`, `BCV historial ${iso}`);
  const tasaHist = tasaDesdePayload(history);
  const fechaHist = fechaDesdePayload(history);
  if (tasaHist && (!fechaHist || fechaHist === iso)) {
    return {
      fecha: iso,
      tasa_bcv_ves_por_usd: tasaHist,
      fuente: 'bcv.today',
      fecha_valor: fechaHist ?? iso,
      estado: 'actualizada',
    };
  }

  const porFecha = await fetchBcvJson(`${BCV_RAFNIXG_URL}/${iso}`, `BCV rafnixg ${iso}`);
  const tasaFecha = tasaDesdePayload(porFecha);
  const fechaRaf = fechaDesdePayload(porFecha);
  if (tasaFecha && (!fechaRaf || fechaRaf === iso)) {
    return {
      fecha: iso,
      tasa_bcv_ves_por_usd: tasaFecha,
      fuente: 'bcv.rafnixg',
      fecha_valor: fechaRaf ?? iso,
      estado: 'actualizada',
    };
  }

  return null;
}

async function tasaDesdeConfigNomina(
  supabase: SupabaseClient,
  iso: string,
): Promise<TasaBcvResult | null> {
  try {
    const config = await obtenerTasaBcvConfigNominaGlobal(supabase);
    if (!config?.tasa_bcv_ves_por_usd) return null;
    return {
      fecha: iso,
      tasa_bcv_ves_por_usd: config.tasa_bcv_ves_por_usd,
      fuente: 'ci_config_nomina',
      fecha_valor: null,
      estado: 'desactualizada',
    };
  } catch {
    return null;
  }
}

export function etiquetaFuenteTasaBcv(fuente: FuenteTasaBcv | string | null | undefined): string {
  switch (fuente) {
    case FUENTE_BCV_OFICIAL:
      return 'BCV oficial (www.bcv.org.ve)';
    case 'bcv.today':
      return 'Agregador BCV (historial bcv.today)';
    case 'bcv.today_actual':
      return 'Agregador BCV (tasa actual bcv.today)';
    case 'bcv.rafnixg':
      return 'Agregador BCV (bcv-api.rafnixg.dev)';
    case 'ci_config_nomina':
      return 'Configuración nómina (ci_config_nomina GLOBAL)';
    case 'env':
      return 'Variable NEXT_PUBLIC_TASA_BCV_VES_POR_USD';
    default:
      return fuente?.trim() || '—';
  }
}

export function esFuenteTasaBcvConfiable(fuente: FuenteTasaBcv | string | null | undefined): boolean {
  return (
    fuente === FUENTE_BCV_OFICIAL ||
    fuente === 'bcv.today' ||
    fuente === 'bcv.today_actual' ||
    fuente === 'bcv.rafnixg'
  );
}

/**
 * True si la tasa es vigente para esa fecha: misma Fecha Valor, o la última
 * oficial sin día hábil bancario VE de por medio (fin de semana / feriado).
 * Rechaza `desactualizada` cuando falta un día hábil de publicación.
 */
export function esTasaBcvDelDia(
  result: Pick<TasaBcvResult, 'estado' | 'fuente' | 'fecha_valor' | 'fecha'> | null | undefined,
  fecha?: string,
): boolean {
  if (!result) return false;
  if (!esFuenteTasaBcvConfiable(result.fuente)) return false;
  const iso = fecha ? normalizarFechaIso(fecha) : result.fecha;
  const valor = (result.fecha_valor ?? result.fecha)?.slice(0, 10) ?? '';
  if (valor) {
    return estadoTasaParaFechaSolicitada(iso, valor) === 'actualizada';
  }
  return result.estado !== 'desactualizada';
}

/** Bolívares por 1 USD (tasa oficial BCV) para una fecha YYYY-MM-DD. */
export async function obtenerTasaBcvVesPorUsd(
  fecha: string,
  opts?: OpcionesTasaBcv,
): Promise<TasaBcvResult> {
  const iso = normalizarFechaIso(fecha);
  const cached = cacheVigente(iso);
  if (cached) return cached;

  if (opts?.supabase) {
    try {
      const exacta = await leerTasaBcvPorFecha(opts.supabase, iso);
      if (exacta && filaAplicaAFecha(exacta, iso)) {
        return guardarTasaEnCache(iso, resultadoDeFila(iso, exacta));
      }
    } catch (e) {
      console.warn('[bcv] historial ci_tasas_bcv', e instanceof Error ? e.message : e);
    }
  }

  const agregador = opts?.skipLive ? null : await tasaDesdeAgregadorPorFecha(iso);
  if (agregador) {
    if (opts?.supabase) {
      const { error } = await opts.supabase.from('ci_tasas_bcv').upsert(
        {
          fecha: iso,
          usd: agregador.tasa_bcv_ves_por_usd,
          fuente: agregador.fuente,
          fecha_valor: agregador.fecha_valor ?? iso,
        },
        { onConflict: 'fecha' },
      );
      if (error && !tablaAusente(error)) {
        console.warn('[bcv] no se pudo guardar agregador', error.message);
      }
    }
    return guardarTasaEnCache(iso, agregador);
  }

  if (opts?.supabase) {
    try {
      const anterior = await leerTasaBcvAnterior(opts.supabase, iso);
      if (anterior) {
        return guardarTasaEnCache(iso, resultadoDeFila(iso, anterior));
      }
    } catch (e) {
      console.warn('[bcv] tasa anterior', e instanceof Error ? e.message : e);
    }

    const config = await tasaDesdeConfigNomina(opts.supabase, iso);
    if (config) return guardarTasaEnCache(iso, config);
  }

  const env = tasaBcvVesPorUsdFromEnv();
  if (env) {
    return guardarTasaEnCache(iso, {
      fecha: iso,
      tasa_bcv_ves_por_usd: env,
      fuente: 'env',
      fecha_valor: null,
      estado: 'desactualizada',
    });
  }

  throw new Error(
    `No hay tasa BCV para ${iso}. Consulte www.bcv.org.ve, el histórico ci_tasas_bcv o configure ci_config_nomina GLOBAL.`,
  );
}

/** Obtiene tasa BCV vía API interna (navegador) o consulta directa (servidor). */
export async function resolverTasaBcvVesPorUsd(
  fecha: string,
  provided?: number | null,
): Promise<TasaBcvResult> {
  if (provided != null && provided > 0) {
    const iso = normalizarFechaIso(fecha);
    return {
      fecha: iso,
      tasa_bcv_ves_por_usd: provided,
      fuente: 'env',
      fecha_valor: iso,
      estado: 'actualizada',
    };
  }
  if (typeof window !== 'undefined') {
    const res = await fetch(
      `/api/finanzas/bcv-tasa?fecha=${encodeURIComponent(normalizarFechaIso(fecha))}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'No se pudo obtener la tasa BCV.');
    }
    const json = (await res.json()) as TasaBcvResult;
    return {
      ...json,
      estado: json.estado === 'desactualizada' ? 'desactualizada' : 'actualizada',
    };
  }
  return obtenerTasaBcvVesPorUsd(fecha);
}
