import type { SupabaseClient } from '@supabase/supabase-js';

/** Plazo de «Procura por aprobar» en la Torre de Control (igual que ETAPAS_CUELLO). */
export const UMBRAL_APROBACION_HORAS = 24;

/**
 * ¿La procura lleva más del plazo esperando al PM? Se mide desde que pasó a
 * «pendiente_pm» (historial de estados), no desde su última edición.
 * Con esto administración puede aprobarla o rechazarla desde la Torre de Control.
 */
export async function procuraDetenidaEsperandoPm(
  supabase: SupabaseClient,
  procuraId: string,
  ahora: number = Date.now(),
): Promise<boolean> {
  const { data: p } = await supabase.from('ci_procuras').select('estado,created_at').eq('id', procuraId).maybeSingle();
  const fila = p as { estado?: string | null; created_at?: string | null } | null;
  if (String(fila?.estado ?? '') !== 'pendiente_pm') return false;
  const { data: hist } = await supabase
    .from('ci_procura_estados_historial')
    .select('created_at')
    .eq('procura_id', procuraId)
    .eq('estado_nuevo', 'pendiente_pm')
    .order('created_at', { ascending: false })
    .limit(1);
  const desde = String(((hist ?? []) as Array<{ created_at?: string }>)[0]?.created_at ?? fila?.created_at ?? '');
  const t = Date.parse(desde);
  if (!Number.isFinite(t)) return false;
  return (ahora - t) / 3_600_000 >= UMBRAL_APROBACION_HORAS;
}
