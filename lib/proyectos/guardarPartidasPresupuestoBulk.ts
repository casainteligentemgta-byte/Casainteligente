import type { SupabaseClient } from '@supabase/supabase-js';
import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { sanitizePartidaNumericFields } from '@/lib/utils/numericDbLimits';

/** Tamaño de lote para bulk insert en Supabase (PostgREST). */
export const PARTIDAS_PRESUPUESTO_BATCH_SIZE = 200;

const ORIGENES_LULO_DEFAULT = ['lulo_csv', 'lulo_mdb'] as const;

/**
 * Normaliza el arreglo de partidas del parser MDB/CSV y fuerza `proyecto_id`
 * al del proyecto indicado (parámetro de la API).
 */
export function prepararPartidasParaProyecto(
  partidas: ReadonlyArray<Partial<PartidaLuloInsert>>,
  proyectoId: string,
): PartidaLuloInsert[] {
  const pid = proyectoId.trim();
  if (!pid) {
    throw new Error('proyecto_id es obligatorio para guardar partidas de presupuesto.');
  }

  return partidas.map((p) => {
    const codigo = String(p.codigo_partida ?? '').trim();
    const descripcion = String(p.descripcion ?? '').trim();

    return sanitizePartidaNumericFields({
      proyecto_id: pid,
      codigo_partida: codigo,
      descripcion: descripcion || codigo || 'Partida importada',
      unidad: String(p.unidad ?? 'UND').trim() || 'UND',
      cantidad_presupuestada: Number(p.cantidad_presupuestada),
      precio_unitario_estimado: Number(p.precio_unitario_estimado),
      monto_total_estimado: Number(p.monto_total_estimado),
      origen: String(p.origen ?? 'lulo_mdb').trim() || 'lulo_mdb',
      capitulo_codigo: p.capitulo_codigo?.trim() || null,
      capitulo_descripcion: p.capitulo_descripcion?.trim() || null,
      capitulo_orden: Number.isFinite(Number(p.capitulo_orden)) ? Number(p.capitulo_orden) : 0,
    });
  });
}

export async function eliminarPartidasLuloDeProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  origenes: readonly string[] = ORIGENES_LULO_DEFAULT,
): Promise<void> {
  const pid = proyectoId.trim();
  if (!pid) return;

  const { error } = await supabase
    .from('ci_presupuesto_partidas')
    .delete()
    .eq('proyecto_id', pid)
    .in('origen', [...origenes]);

  if (error) throw new Error(formatErrorMessage(error));
}

/**
 * Bulk insert de partidas en `ci_presupuesto_partidas`, asociadas al `proyecto_id`.
 */
export async function bulkInsertCiPresupuestoPartidas(
  supabase: SupabaseClient,
  proyectoId: string,
  partidas: ReadonlyArray<Partial<PartidaLuloInsert>>,
  options?: {
    reemplazar?: boolean;
    origenesReemplazo?: readonly string[];
  },
): Promise<{ insertadas: number }> {
  const filas = prepararPartidasParaProyecto(partidas, proyectoId);
  if (filas.length === 0) {
    return { insertadas: 0 };
  }

  if (options?.reemplazar) {
    await eliminarPartidasLuloDeProyecto(
      supabase,
      proyectoId,
      options.origenesReemplazo ?? ORIGENES_LULO_DEFAULT,
    );
  }

  for (let i = 0; i < filas.length; i += PARTIDAS_PRESUPUESTO_BATCH_SIZE) {
    const batch = filas.slice(i, i + PARTIDAS_PRESUPUESTO_BATCH_SIZE);
    const { error } = await supabase.from('ci_presupuesto_partidas').insert(batch);
    if (error) {
      const msg = formatErrorMessage(error);
      if (/capitulo_/i.test(msg)) {
        throw new Error(
          `${msg} — Aplica la migración 158_ci_presupuesto_partidas_capitulo.sql (npm run db:apply-lulo-telegram).`,
        );
      }
      if (/22003|numeric field overflow/i.test(msg)) {
        throw new Error(
          `${msg} — Hay montos fuera de rango en el MDB (columna mal mapeada o cantidad×precio enorme). Vuelve a importar tras actualizar; los valores se acotan automáticamente.`,
        );
      }
      throw new Error(msg);
    }
  }

  return { insertadas: filas.length };
}
