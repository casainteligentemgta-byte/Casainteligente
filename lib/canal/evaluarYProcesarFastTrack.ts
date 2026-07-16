import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { ejecutarFastTrackFacturaCanal } from '@/lib/canal/ejecutarFastTrackFactura';
import { evaluarFastTrackFactura } from '@/lib/canal/evaluarFastTrackFactura';

export type DatosOcrFastTrack = ExtractedPurchaseInvoice & {
  confidence_score?: number;
  fromGemini?: boolean;
  modelUsed?: string;
};

export type ResultadoEvaluarYProcesarFastTrack = {
  success: boolean;
  estado: 'aprobado_sistema' | 'extraido';
  error?: string;
  confidenceScore?: number;
  totalUsd?: number;
  motivo?: string;
};

type FastTrackAudit = {
  auto_approved?: boolean;
  motivo_desvio?: string;
  error_pipeline?: string;
  evaluado_at?: string;
};

function enrichedExtracted(
  datosOcr: DatosOcrFastTrack,
  audit: FastTrackAudit,
): Record<string, unknown> {
  return {
    ...datosOcr,
    fast_track: {
      ...audit,
      evaluado_at: audit.evaluado_at ?? new Date().toISOString(),
    },
  };
}

async function persistirEstadoExtraido(
  supabase: SupabaseClient,
  facturaId: string,
  datosOcr: DatosOcrFastTrack,
  audit: FastTrackAudit,
): Promise<void> {
  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'extraido',
      extracted: enrichedExtracted(datosOcr, audit),
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', facturaId);
}

/**
 * Evalúa reglas Fast-Track OCR y, si aplica, aprueba e impacta inventario.
 * Escudo anti-bucle: cualquier fallo degrada a `extraido` para picking manual (HTTP 200 al webhook).
 */
export async function evaluarYProcesarFastTrack(
  supabase: SupabaseClient,
  facturaId: string,
  datosOcr: DatosOcrFastTrack,
): Promise<ResultadoEvaluarYProcesarFastTrack> {
  try {
    const { data: pendMeta } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('proyecto_id')
      .eq('id', facturaId)
      .maybeSingle();

    const proyectoId =
      typeof pendMeta?.proyecto_id === 'string' ? pendMeta.proyecto_id : null;

    const evaluacion = await evaluarFastTrackFactura(supabase, datosOcr, proyectoId);

    if (!evaluacion.elegible) {
      await persistirEstadoExtraido(supabase, facturaId, datosOcr, {
        motivo_desvio: evaluacion.motivo ?? 'No cumple umbrales de automatización',
      });
      return {
        success: true,
        estado: 'extraido',
        confidenceScore: evaluacion.confidenceScore,
        totalUsd: evaluacion.totalUsd,
        motivo: evaluacion.motivo,
      };
    }

    const resultado = await ejecutarFastTrackFacturaCanal(supabase, facturaId, datosOcr);

    if (resultado.aplicado) {
      return {
        success: true,
        estado: 'aprobado_sistema',
        confidenceScore: resultado.confidenceScore,
        totalUsd: evaluacion.totalUsd,
      };
    }

    await persistirEstadoExtraido(supabase, facturaId, datosOcr, {
      motivo_desvio: resultado.motivo ?? 'Fast-track no aplicado',
    });

    return {
      success: true,
      estado: 'extraido',
      confidenceScore: resultado.confidenceScore ?? evaluacion.confidenceScore,
      totalUsd: evaluacion.totalUsd,
      motivo: resultado.motivo,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error crítico en emparejamiento de SKU';
    console.error(
      `[CRITICAL OCR FAULT] Fallo en procesamiento automático para factura ${facturaId}:`,
      error,
    );

    try {
      await persistirEstadoExtraido(supabase, facturaId, datosOcr, {
        error_pipeline: message,
      });
    } catch (persistErr) {
      console.error('[evaluarYProcesarFastTrack] no se pudo degradar a extraido:', persistErr);
    }

    return {
      success: false,
      estado: 'extraido',
      error: message,
    };
  }
}
