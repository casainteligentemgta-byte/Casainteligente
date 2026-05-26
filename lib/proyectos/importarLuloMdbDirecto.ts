import type { SupabaseClient } from '@supabase/supabase-js';
import { extractFullLuloMdb } from '@/lib/proyectos/extractLuloFull';
import { formatMdbReadError, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import {
  parseAndValidateLuloMdbCascada,
  type LuloMdbCascadaModel,
} from '@/lib/proyectos/parseLuloMdbCascada';
import {
  persistirLuloMdbCascada,
  type PersistirLuloMdbCascadaResult,
} from '@/lib/proyectos/persistirLuloMdbCascada';
import {
  cargarPresupuestoLuloDesdeMdb,
  type CargarPresupuestoLuloResult,
} from '@/lib/proyectos/presupuestosLulo';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export type ImportarLuloMdbDirectoResult = PersistirLuloMdbCascadaResult & {
  tablasUsadas: LuloMdbCascadaModel['tablasUsadas'];
  reemplazar: boolean;
  nombreArchivo: string;
};

export type ImportarLuloMdbDirectoOptions = {
  reemplazar?: boolean;
  nombreArchivo?: string;
  presupuestoLuloId?: string;
  reemplazarPresupuestosPrevios?: boolean;
  codigoObr?: string;
  nombrePresupuesto?: string;
};

/**
 * Importación directa LuloWin (.mdb) → proyectos/capitulos/partidas/apu_items.
 */
export async function importarLuloMdbDirecto(
  supabase: SupabaseClient,
  proyectoId: string,
  fileBuffer: Buffer | ArrayBuffer | Uint8Array,
  options?: ImportarLuloMdbDirectoOptions,
): Promise<ImportarLuloMdbDirectoResult | CargarPresupuestoLuloResult> {
  if (options?.reemplazarPresupuestosPrevios) {
    return cargarPresupuestoLuloDesdeMdb(supabase, proyectoId, fileBuffer, {
      codigoObr: options.codigoObr,
      nombrePresupuesto: options.nombrePresupuesto,
      nombreArchivo: options.nombreArchivo,
    });
  }

  const buffer = toMdbNodeBuffer(fileBuffer);
  let dump;
  try {
    dump = extractFullLuloMdb(buffer);
  } catch (err) {
    throw new Error(formatMdbReadError(err));
  }

  const validacion = parseAndValidateLuloMdbCascada(dump, proyectoId.trim());
  if (!validacion.ok) {
    const msg = [...validacion.errors, validacion.hint].filter(Boolean).join(' ');
    const err = new Error(msg) as Error & { statusCode?: number; tablasDetectadas?: string[] };
    err.statusCode = 422;
    err.tablasDetectadas = validacion.tablasDetectadas;
    throw err;
  }

  try {
    const persisted = await persistirLuloMdbCascada(
      supabase,
      proyectoId,
      validacion.model,
      {
        reemplazar: options?.reemplazar ?? false,
        presupuestoLuloId: options?.presupuestoLuloId,
      },
    );

    return {
      ...persisted,
      tablasUsadas: validacion.model.tablasUsadas,
      reemplazar: options?.reemplazar ?? false,
      nombreArchivo: options?.nombreArchivo ?? 'presupuesto.mdb',
    };
  } catch (err) {
    throw new Error(formatErrorMessage(err));
  }
}
