import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarAlertasConfig } from '@/lib/alertas/alertasConfig';

/** Fallback de resiliencia si el proyecto no existe o la columna falla. */
export const LIMITE_FAST_TRACK_USD_DEFAULT = 100;

export async function resolverLimiteFastTrackUsd(
  supabase: SupabaseClient,
  proyectoId: string | null | undefined,
): Promise<number> {
  const { config: alertas } = await cargarAlertasConfig(supabase);
  const limiteGlobal = alertas.fastTrack.limiteUsdDefault;

  const id = proyectoId?.trim();
  if (!id) return limiteGlobal;

  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('limite_fast_track_usd')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn('[resolverLimiteFastTrackUsd]', error.message);
    return limiteGlobal;
  }

  const raw = data?.limite_fast_track_usd;
  if (raw == null) return limiteGlobal;

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return limiteGlobal;

  return n;
}
