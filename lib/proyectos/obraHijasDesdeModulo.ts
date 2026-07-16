import type { SupabaseClient } from '@supabase/supabase-js';

/** Obras Talento con `proyecto_modulo_origen_id` = módulo integral (migración 103). */
export async function idsObrasHijasDesdeModuloIntegral(
  supabase: SupabaseClient,
  moduloIntegralId: string,
): Promise<string[]> {
  const id = moduloIntegralId.trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id')
    .eq('proyecto_modulo_origen_id', id);
  if (error) {
    const m = (error.message ?? '').toLowerCase();
    if (m.includes('proyecto_modulo_origen') || m.includes('schema cache') || m.includes('column')) {
      return [];
    }
  }
  return (data ?? [])
    .map((r) => (typeof (r as { id?: unknown }).id === 'string' ? (r as { id: string }).id : ''))
    .filter(Boolean);
}
