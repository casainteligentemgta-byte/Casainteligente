import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Dos orígenes físicos en Supabase (`ci_proyectos` vs `ci_obras`).
 * En la UI se presentan como un solo concepto «proyecto» con subtipo.
 */
export type FuenteProyectoCi = 'integral' | 'talento';

export type OpcionProyectoReclutamiento = {
  key: string;
  etiqueta: string;
  fuente: FuenteProyectoCi;
  proyectoModuloId: string | null;
  proyectoObraId: string | null;
};

export function etiquetaFuenteProyecto(fuente: FuenteProyectoCi): string {
  return fuente === 'integral' ? 'Integral' : 'Talento';
}

/** Texto para pie de listado / ayudas (sin nombres de tablas SQL). */
export const TEXTO_LISTADO_PROYECTOS_UNIFICADO =
  'Un solo listado: proyectos del módulo integral y obras Talento. En la base siguen en tablas distintas; aquí se muestran juntos.';

export type LoadOpcionesProyectoReclutamientoOpts = {
  /** Si true, solo filas `ci_obras` con `estado = 'activa'` (p. ej. vacantes CEO). */
  soloObrasActivas?: boolean;
};

/**
 * Opciones para selects de reclutamiento (vacantes): lee `ci_proyectos` y `ci_obras`.
 */
export async function loadOpcionesProyectoReclutamiento(
  supabase: SupabaseClient,
  opts?: LoadOpcionesProyectoReclutamientoOpts,
): Promise<{ opciones: OpcionProyectoReclutamiento[]; errors: string[] }> {
  const errors: string[] = [];
  let obrQuery = supabase.from('ci_obras').select('id,nombre').order('created_at', { ascending: false }).limit(250);
  if (opts?.soloObrasActivas) {
    obrQuery = obrQuery.eq('estado', 'activa');
  }
  const [modRes, obrRes] = await Promise.all([
    supabase.from('ci_proyectos').select('id,nombre').order('created_at', { ascending: false }).limit(250),
    obrQuery,
  ]);

  const opciones: OpcionProyectoReclutamiento[] = [];

  if (modRes.error) {
    errors.push(modRes.error.message ?? 'No se pudieron cargar proyectos (integral).');
  } else {
    for (const r of modRes.data ?? []) {
      const id = String((r as { id: unknown }).id);
      const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
      opciones.push({
        key: `i:${id}`,
        etiqueta: `${nombre} · ${etiquetaFuenteProyecto('integral')}`,
        fuente: 'integral',
        proyectoModuloId: id,
        proyectoObraId: null,
      });
    }
  }

  if (obrRes.error) {
    errors.push(obrRes.error.message ?? 'No se pudieron cargar proyectos (Talento).');
  } else {
    for (const r of obrRes.data ?? []) {
      const id = String((r as { id: unknown }).id);
      const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
      opciones.push({
        key: `t:${id}`,
        etiqueta: `${nombre} · ${etiquetaFuenteProyecto('talento')}`,
        fuente: 'talento',
        proyectoModuloId: null,
        proyectoObraId: id,
      });
    }
  }

  return { opciones, errors };
}
