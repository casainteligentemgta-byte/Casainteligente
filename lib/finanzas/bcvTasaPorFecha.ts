import type { SupabaseClient } from '@supabase/supabase-js';
import { obtenerTasaBcvConfigNominaGlobal } from '@/lib/contabilidad/tasaBcvConfigNomina';
import { tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import { outboundFetch } from '@/lib/network/outboundFetch';

export { calcularGastoBimonetario, montoUsdAVes, montoVesAUsd } from '@/lib/finanzas/currency-converter';
export type { BimonetarioResult, MonedaOrigen } from '@/lib/finanzas/currency-converter';

const BCV_HISTORY_URL = 'https://bcv.today/api/v1/history';
const BCV_RATE_URL = 'https://bcv.today/api/v1/rate.json';
const BCV_RAFNIXG_URL = 'https://bcv-api.rafnixg.dev/rates';
const BCV_FETCH_TIMEOUT_MS = 8_000;
/** Solo si fallan API, env y ci_config_nomina. */
const TASA_BCV_FALLBACK_DEFAULT = 36.5;

const tasaCache = new Map<string, { result: TasaBcvResult; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export type FuenteTasaBcv =
  | 'bcv.today'
  | 'bcv.today_actual'
  | 'bcv.rafnixg'
  | 'ci_config_nomina'
  | 'env'
  | 'fallback';

export type TasaBcvResult = {
  fecha: string;
  tasa_bcv_ves_por_usd: number;
  fuente: FuenteTasaBcv;
};

export type OpcionesTasaBcv = {
  supabase?: SupabaseClient;
};

function normalizarFechaIso(fecha: string): string {
  const s = fecha.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date().toISOString().slice(0, 10);
  }
  return s;
}

function numeroTasaPositivo(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
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

function guardarTasaEnCache(iso: string, result: TasaBcvResult): TasaBcvResult {
  tasaCache.set(iso, { result, at: Date.now() });
  return result;
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

async function tasaDesdeBcvToday(iso: string, hoy: string): Promise<TasaBcvResult | null> {
  const history = await fetchBcvJson(`${BCV_HISTORY_URL}/${iso}.json`, `BCV historial ${iso}`);
  const tasaHist = tasaDesdePayload(history);
  if (tasaHist) {
    return { fecha: iso, tasa_bcv_ves_por_usd: tasaHist, fuente: 'bcv.today' };
  }

  if (iso >= hoy) {
    const actual = await fetchBcvJson(BCV_RATE_URL, 'BCV tasa actual');
    const tasaAct = tasaDesdePayload(actual);
    if (tasaAct) {
      return { fecha: iso, tasa_bcv_ves_por_usd: tasaAct, fuente: 'bcv.today_actual' };
    }
  }

  return null;
}

async function tasaDesdeRafnixg(iso: string, hoy: string): Promise<TasaBcvResult | null> {
  const porFecha = await fetchBcvJson(`${BCV_RAFNIXG_URL}/${iso}`, `BCV rafnixg ${iso}`);
  const tasaFecha = tasaDesdePayload(porFecha);
  if (tasaFecha) {
    return { fecha: iso, tasa_bcv_ves_por_usd: tasaFecha, fuente: 'bcv.rafnixg' };
  }

  if (iso >= hoy) {
    const latest = await fetchBcvJson(`${BCV_RAFNIXG_URL}/`, 'BCV rafnixg actual');
    const tasaLatest = tasaDesdePayload(latest);
    if (tasaLatest) {
      return { fecha: iso, tasa_bcv_ves_por_usd: tasaLatest, fuente: 'bcv.rafnixg' };
    }
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
    };
  } catch {
    return null;
  }
}

export function etiquetaFuenteTasaBcv(fuente: FuenteTasaBcv | string | null | undefined): string {
  switch (fuente) {
    case 'bcv.today':
      return 'BCV oficial (historial bcv.today)';
    case 'bcv.today_actual':
      return 'BCV oficial (tasa actual bcv.today)';
    case 'bcv.rafnixg':
      return 'BCV (bcv-api.rafnixg.dev)';
    case 'ci_config_nomina':
      return 'Configuración nómina (ci_config_nomina GLOBAL)';
    case 'env':
      return 'Variable NEXT_PUBLIC_TASA_BCV_VES_POR_USD';
    case 'fallback':
      return `Tasa por defecto (${TASA_BCV_FALLBACK_DEFAULT}) — actualice config o .env`;
    default:
      return fuente?.trim() || '—';
  }
}

export function esFuenteTasaBcvConfiable(fuente: FuenteTasaBcv | string | null | undefined): boolean {
  return (
    fuente === 'bcv.today' ||
    fuente === 'bcv.today_actual' ||
    fuente === 'bcv.rafnixg'
  );
}

/** Bolívares por 1 USD (tasa oficial BCV) para una fecha YYYY-MM-DD. */
export async function obtenerTasaBcvVesPorUsd(
  fecha: string,
  opts?: OpcionesTasaBcv,
): Promise<TasaBcvResult> {
  const iso = normalizarFechaIso(fecha);
  const cached = tasaCache.get(iso);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }
  const hoy = new Date().toISOString().slice(0, 10);

  const bcvToday = await tasaDesdeBcvToday(iso, hoy);
  if (bcvToday) return guardarTasaEnCache(iso, bcvToday);

  const rafnixg = await tasaDesdeRafnixg(iso, hoy);
  if (rafnixg) return guardarTasaEnCache(iso, rafnixg);

  if (opts?.supabase) {
    const config = await tasaDesdeConfigNomina(opts.supabase, iso);
    if (config) return guardarTasaEnCache(iso, config);
  }

  const env = tasaBcvVesPorUsdFromEnv();
  if (env) {
    return guardarTasaEnCache(iso, { fecha: iso, tasa_bcv_ves_por_usd: env, fuente: 'env' });
  }

  return guardarTasaEnCache(iso, {
    fecha: iso,
    tasa_bcv_ves_por_usd: TASA_BCV_FALLBACK_DEFAULT,
    fuente: 'fallback',
  });
}

/** Obtiene tasa BCV vía API interna (navegador) o consulta directa (servidor). */
export async function resolverTasaBcvVesPorUsd(
  fecha: string,
  provided?: number | null,
): Promise<TasaBcvResult> {
  if (provided != null && provided > 0) {
    return {
      fecha: normalizarFechaIso(fecha),
      tasa_bcv_ves_por_usd: provided,
      fuente: 'env',
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
    return (await res.json()) as TasaBcvResult;
  }
  return obtenerTasaBcvVesPorUsd(fecha);
}
