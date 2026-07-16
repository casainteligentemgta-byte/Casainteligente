import type { SupabaseClient } from '@supabase/supabase-js';
import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import { prepareLuloMdbDumpForParse } from '@/lib/proyectos/loadLuloCsvFolder';
import { parseLuloMdbEstructurado } from '@/lib/proyectos/parseLuloMdbEstructurado';
import {
  persistirLuloEstructurado,
  type PersistirLuloEstructuradoResult,
} from '@/lib/proyectos/persistirLuloEstructurado';
import { validarLuloEstructurado } from '@/lib/proyectos/validarLuloEstructurado';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export type ImportarPresupuestoConstruccionResult = PersistirLuloEstructuradoResult & {
  presupuestoTotal: number;
  tablasUsadas: NonNullable<ReturnType<typeof parseLuloMdbEstructurado>>['tablasUsadas'];
};

/**
 * Importación en cascada Lulo (MDB nativo):
 * insumos maestro → partidas (+ capítulos denormalizados) → APU → techo_teorico_material.
 *
 * El `proyecto_id` debe existir en `ci_proyectos` antes de llamar.
 */
export async function importarPresupuestoConstruccionDesdeMdb(
  supabase: SupabaseClient,
  proyectoId: string,
  dump: LuloMdbFullDump,
  options?: { reemplazar?: boolean },
): Promise<ImportarPresupuestoConstruccionResult> {
  const prepared = prepareLuloMdbDumpForParse(dump);
  const structured = parseLuloMdbEstructurado(prepared, proyectoId);
  if (!structured || structured.partidas.length === 0) {
    throw new Error(
      'El MDB no tiene estructura reconocible (PARTIDAS/INSUMOS o tablas Obra* con partidas y APU). Use mapeo manual o inspeccione el archivo en Datos Lulo.',
    );
  }

  const validacion = validarLuloEstructurado(structured);
  if (!validacion.ok) {
    throw new Error([...validacion.errors, validacion.hint].filter(Boolean).join(' '));
  }

  try {
    const persisted = await persistirLuloEstructurado(supabase, proyectoId, structured, options);
    const presupuestoTotal = structured.partidas.reduce(
      (s, p) => s + p.monto_total_estimado,
      0,
    );
    return {
      ...persisted,
      presupuestoTotal,
      tablasUsadas: structured.tablasUsadas,
    };
  } catch (err) {
    throw new Error(formatErrorMessage(err));
  }
}
