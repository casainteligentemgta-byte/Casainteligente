import { tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import { outboundFetch } from '@/lib/network/outboundFetch';

export { calcularGastoBimonetario, montoUsdAVes, montoVesAUsd } from '@/lib/finanzas/currency-converter';
export type { BimonetarioResult, MonedaOrigen } from '@/lib/finanzas/currency-converter';

const BCV_HISTORY_URL = 'https://bcv.today/api/v1/history';
const BCV_RATE_URL = 'https://bcv.today/api/v1/rate.json';

export type TasaBcvResult = {
  fecha: string;
  tasa_bcv_ves_por_usd: number;
  fuente: 'bcv.today' | 'bcv.today_actual' | 'env' | 'fallback';
};

function normalizarFechaIso(fecha: string): string {
  const s = fecha.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date().toISOString().slice(0, 10);
  }
  return s;
}

function tasaDesdePayload(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const usd = (data as { USD?: unknown }).USD;
  const n = Number(usd);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Bolívares por 1 USD (tasa oficial BCV) para una fecha YYYY-MM-DD. */
export async function obtenerTasaBcvVesPorUsd(fecha: string): Promise<TasaBcvResult> {
  const iso = normalizarFechaIso(fecha);
  const hoy = new Date().toISOString().slice(0, 10);

  try {
    const historyUrl = `${BCV_HISTORY_URL}/${iso}.json`;
    const res = await outboundFetch(historyUrl, { method: 'GET' }, `BCV tasa ${iso}`);
    if (res.ok) {
      const data = (await res.json()) as unknown;
      const tasa = tasaDesdePayload(data);
      if (tasa) return { fecha: iso, tasa_bcv_ves_por_usd: tasa, fuente: 'bcv.today' };
    }
  } catch {
    /* historial no disponible para esa fecha */
  }

  if (iso >= hoy) {
    try {
      const res = await outboundFetch(BCV_RATE_URL, { method: 'GET' }, 'BCV tasa actual');
      if (res.ok) {
        const data = (await res.json()) as unknown;
        const tasa = tasaDesdePayload(data);
        if (tasa) return { fecha: iso, tasa_bcv_ves_por_usd: tasa, fuente: 'bcv.today_actual' };
      }
    } catch {
      /* sigue a fallback */
    }
  }

  const env = tasaBcvVesPorUsdFromEnv();
  if (env) return { fecha: iso, tasa_bcv_ves_por_usd: env, fuente: 'env' };

  return { fecha: iso, tasa_bcv_ves_por_usd: 36.5, fuente: 'fallback' };
}

/** Obtiene tasa BCV vía API interna (navegador) o consulta directa (servidor). */
export async function resolverTasaBcvVesPorUsd(
  fecha: string,
  provided?: number | null
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
      `/api/finanzas/bcv-tasa?fecha=${encodeURIComponent(normalizarFechaIso(fecha))}`
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || 'No se pudo obtener la tasa BCV.');
    }
    return (await res.json()) as TasaBcvResult;
  }
  return obtenerTasaBcvVesPorUsd(fecha);
}
