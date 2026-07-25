import type { SupabaseClient } from '@supabase/supabase-js';
import { bulkInsertCiPresupuestoPartidas } from '@/lib/proyectos/guardarPartidasPresupuestoBulk';
import { cargarAnalisisMetron } from '@/lib/metron/persistirAnalisis';
import type { MetronAnalisisRow } from '@/types/metron';

export const METRON_ORIGEN_PARTIDA = 'metron';

/**
 * Inserta cómputos aprobados de un análisis Metron en ci_presupuesto_partidas.
 * Por defecto no borra partidas Lulo; solo agrega origen=metron (o reemplaza solo metron).
 */
export async function aplicarAnalisisMetronAPresupuesto(
  supabase: SupabaseClient,
  analisisId: string,
  options?: { reemplazarMetron?: boolean; soloAprobados?: boolean },
): Promise<{ insertadas: number; analisis: MetronAnalisisRow }> {
  const analisis = await cargarAnalisisMetron(supabase, analisisId);
  if (!analisis) {
    throw new Error('Análisis Metron no encontrado.');
  }
  if (analisis.status === 'error') {
    throw new Error('El análisis está en error; no se puede aplicar.');
  }

  const soloAprobados = options?.soloAprobados !== false;
  const lineas = (analisis.computos ?? []).filter((c) => {
    if (soloAprobados && !c.aprobado) return false;
    return c.descripcion.trim() && c.cantidad > 0;
  });

  if (lineas.length === 0) {
    throw new Error('No hay cómputos aprobados con cantidad > 0 para aplicar.');
  }

  const partidas = lineas.map((c) => ({
    proyecto_id: analisis.proyecto_id,
    codigo_partida: c.codigo_sugerido || `MTR-${c.orden + 1}`,
    descripcion: c.descripcion,
    unidad: c.unidad || 'UND',
    cantidad_presupuestada: c.cantidad,
    precio_unitario_estimado: c.precio_unitario_estimado,
    monto_total_estimado: c.monto_estimado || c.cantidad * c.precio_unitario_estimado,
    origen: METRON_ORIGEN_PARTIDA,
    capitulo_codigo: null as string | null,
    capitulo_descripcion: c.capitulo_sugerido || null,
    capitulo_orden: 0,
  }));

  const { insertadas } = await bulkInsertCiPresupuestoPartidas(
    supabase,
    analisis.proyecto_id,
    partidas,
    {
      reemplazar: Boolean(options?.reemplazarMetron),
      origenesReemplazo: [METRON_ORIGEN_PARTIDA],
    },
  );

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from('ci_metron_analisis')
    .update({ status: 'aplicado', updated_at: now } as never)
    .eq('id', analisisId);

  if (upErr) {
    throw new Error(upErr.message || 'Partidas insertadas pero no se actualizó el status.');
  }

  const refreshed = await cargarAnalisisMetron(supabase, analisisId);
  return { insertadas, analisis: refreshed ?? { ...analisis, status: 'aplicado' } };
}
