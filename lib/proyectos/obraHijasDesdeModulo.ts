import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Obras Talento con `proyecto_modulo_origen_id` = módulo integral (migración 103).
 * Solo incluye `tipo_proyecto = 'talento'`: otro módulo integral no debe entrar al alcance
 * (evita mezclar p. ej. Flamboyant con Juan de Castellanos y duplicar express).
 */
export async function idsObrasHijasDesdeModuloIntegral(
  supabase: SupabaseClient,
  moduloIntegralId: string,
): Promise<string[]> {
  const id = moduloIntegralId.trim();
  if (!id) return [];

  const withTipo = await supabase
    .from('ci_proyectos')
    .select('id')
    .eq('proyecto_modulo_origen_id', id)
    .eq('tipo_proyecto', 'talento');

  if (!withTipo.error) {
    return (withTipo.data ?? [])
      .map((r) => (typeof (r as { id?: unknown }).id === 'string' ? (r as { id: string }).id : ''))
      .filter(Boolean);
  }

  const m = (withTipo.error.message ?? '').toLowerCase();
  if (m.includes('proyecto_modulo_origen') || m.includes('schema cache') || m.includes('column')) {
    if (m.includes('proyecto_modulo_origen')) return [];
  }

  const bare = await supabase.from('ci_proyectos').select('id,tipo_proyecto').eq('proyecto_modulo_origen_id', id);
  if (bare.error) {
    return [];
  }

  return (bare.data ?? [])
    .filter((r) => {
      const tipo = String((r as { tipo_proyecto?: unknown }).tipo_proyecto ?? 'integral').trim().toLowerCase();
      return tipo === 'talento';
    })
    .map((r) => (typeof (r as { id?: unknown }).id === 'string' ? (r as { id: string }).id : ''))
    .filter(Boolean);
}
