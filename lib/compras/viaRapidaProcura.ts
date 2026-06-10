import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarAlertasConfig } from '@/lib/alertas/alertasConfig';

export type EvaluacionViaRapida = {
  califica: boolean;
  motivo: string;
  limiteUsd: number;
};

const PALABRAS_CONSUMIBLE = [
  'consumible',
  'consumibles',
  'papel',
  'tinta',
  'toner',
  'tóner',
  'lapicero',
  'bateria',
  'batería',
  'cinta',
  'pegamento',
  'detergente',
  'guante',
  'mascarilla',
  'brocha',
  'lija',
];

/** Tope USD para vía rápida (configurable en ci_alertas_config.fast_track). */
export async function limiteViaRapidaUsd(
  supabase: SupabaseClient,
  override?: number,
): Promise<number> {
  if (override != null && Number.isFinite(override)) return override;
  const { config: alertas } = await cargarAlertasConfig(supabase);
  return alertas.fastTrack.limiteUsdDefault ?? 50;
}

/** Vía rápida: consumible explícito o monto estimado < límite USD configurado. */
export async function evaluarViaRapidaProcura(
  supabase: SupabaseClient,
  params: {
    descripcionMaterial: string;
    montoEstimadoUsd: number | null;
    esConsumible?: boolean;
    limiteUsdOverride?: number;
  },
): Promise<EvaluacionViaRapida> {
  const limiteEfectivo = await limiteViaRapidaUsd(supabase, params.limiteUsdOverride);

  if (params.esConsumible) {
    return {
      califica: true,
      motivo: 'Marcado como consumible',
      limiteUsd: limiteEfectivo,
    };
  }

  const desc = params.descripcionMaterial.toLowerCase();
  if (PALABRAS_CONSUMIBLE.some((p) => desc.includes(p))) {
    return {
      califica: true,
      motivo: 'Material clasificado como consumible por descripción',
      limiteUsd: limiteEfectivo,
    };
  }

  const monto = params.montoEstimadoUsd;
  if (monto != null && Number.isFinite(monto) && monto >= 0 && monto < limiteEfectivo) {
    return {
      califica: true,
      motivo: `Monto estimado USD ${monto.toFixed(2)} < ${limiteEfectivo}`,
      limiteUsd: limiteEfectivo,
    };
  }

  return {
    califica: false,
    motivo:
      monto != null && monto >= limiteEfectivo
        ? `Monto USD ${monto.toFixed(2)} ≥ ${limiteEfectivo} — requiere aprobación`
        : 'Requiere aprobación del Aprobador (sin vía rápida)',
    limiteUsd: limiteEfectivo,
  };
}

export type PrioridadProcura = 'Baja' | 'Media' | 'Alta';

export function parsePrioridadProcura(v: string): PrioridadProcura | null {
  const t = v.trim();
  if (t === 'Baja' || t === 'Media' || t === 'Alta') return t;
  const lower = t.toLowerCase();
  if (lower === 'baja') return 'Baja';
  if (lower === 'media') return 'Media';
  if (lower === 'alta') return 'Alta';
  return null;
}
