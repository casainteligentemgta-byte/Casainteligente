import type { SupabaseClient } from '@supabase/supabase-js';

/** Fallback de resiliencia si el proyecto no existe o la columna falla. */
export const LIMITE_FAST_TRACK_USD_DEFAULT = 100;

export async function resolverLimiteFastTrackUsd(
  supabase: SupabaseClient,
  proyectoId: string | null | undefined,
): Promise<number> {
  const id = proyectoId?.trim();
  if (!id) return LIMITE_FAST_TRACK_USD_DEFAULT;

  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('limite_fast_track_usd')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn('[resolverLimiteFastTrackUsd]', error.message);
    return LIMITE_FAST_TRACK_USD_DEFAULT;
  }

  const raw = data?.limite_fast_track_usd;
  if (raw == null) return LIMITE_FAST_TRACK_USD_DEFAULT;

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return LIMITE_FAST_TRACK_USD_DEFAULT;

  return n;
}
