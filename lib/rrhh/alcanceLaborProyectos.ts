import type { SupabaseClient } from '@supabase/supabase-js';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';

/** IDs de `ci_proyectos` (módulos + obras hijas) para filtrar solicitudes y asignaciones laborales. */
export async function projectIdsAlcanceLaborDesdeModulos(
  supabase: SupabaseClient,
  moduloIntegralIds: string[],
): Promise<string[]> {
  const modulos = Array.from(new Set(moduloIntegralIds.map((s) => s.trim()).filter(Boolean)));
  if (!modulos.length) return [];

  const obraHijaIdsSet = new Set<string>();
  for (const mid of modulos) {
    const hijas = await idsObrasHijasDesdeModuloIntegral(supabase, mid);
    for (const h of hijas) obraHijaIdsSet.add(h);
  }
  return Array.from(new Set([...modulos, ...Array.from(obraHijaIdsSet)]));
}
