import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Subtipos lógicos en `ci_proyectos` (`tipo_proyecto`: integral | talento).
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
  /** Si true, solo filas Talento con `obra_estado_legacy = 'activa'` (p. ej. vacantes CEO). */
  soloObrasActivas?: boolean;
};

/**
 * Opciones para selects de reclutamiento (vacantes): lee `ci_proyectos` por `tipo_proyecto`.
 */
function esColumnaTipoProyectoAusente(msg: string): boolean {
  const m = (msg ?? '').toLowerCase();
  return m.includes('does not exist') && m.includes('tipo_proyecto');
}

export async function loadOpcionesProyectoReclutamiento(
  supabase: SupabaseClient,
  opts?: LoadOpcionesProyectoReclutamientoOpts,
): Promise<{ opciones: OpcionProyectoReclutamiento[]; errors: string[] }> {
  const errors: string[] = [];
  let intQuery = supabase
    .from('ci_proyectos')
    .select('id,nombre')
    .eq('tipo_proyecto', 'integral')
    .order('created_at', { ascending: false })
    .limit(250);
  let talQuery = supabase
    .from('ci_proyectos')
    .select('id,nombre,obra_estado_legacy')
    .eq('tipo_proyecto', 'talento')
    .order('created_at', { ascending: false })
    .limit(250);
  if (opts?.soloObrasActivas) {
    talQuery = talQuery.eq('obra_estado_legacy', 'activa');
  }
  const [modRes, obrRes] = await Promise.all([intQuery, talQuery]);

  const opciones: OpcionProyectoReclutamiento[] = [];

  const fallbackSin086 =
    (modRes.error && esColumnaTipoProyectoAusente(modRes.error.message ?? '')) ||
    (obrRes.error && esColumnaTipoProyectoAusente(obrRes.error.message ?? ''));

  if (fallbackSin086) {
    const { data, error } = await supabase
      .from('ci_proyectos')
      .select('id,nombre')
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) {
      errors.push(error.message ?? 'No se pudieron cargar proyectos.');
    } else {
      errors.push(
        'Falta la columna ci_proyectos.tipo_proyecto (migración 086). Se listan todos los proyectos como integral; no hay distinción Talento hasta aplicar la migración.',
      );
      for (const r of data ?? []) {
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
    return { opciones, errors };
  }

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
