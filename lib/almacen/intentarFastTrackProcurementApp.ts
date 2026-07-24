import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { evaluarFastTrackFactura } from '@/lib/canal/evaluarFastTrackFactura';
import { approveQualityInspection } from '@/lib/almacen/approveQualityInspection';

export type ResultadoFastTrackApp = {
  aplicado: boolean;
  motivo?: string;
  confidenceScore?: number;
  totalUsd?: number;
  inspeccionesAprobadas?: number;
};

/**
 * Tras guardar factura en app: si cumple Fast-Track, aprueba cuarentena e ingresa stock.
 */
export async function intentarFastTrackProcurementApp(
  supabase: SupabaseClient,
  params: {
    purchaseInvoiceId: string;
    proyectoId: string;
    extracted: ExtractedPurchaseInvoice & { confidence_score?: number };
    inspectorId?: string | null;
  },
): Promise<ResultadoFastTrackApp> {
  const evaluacion = await evaluarFastTrackFactura(
    supabase,
    params.extracted,
    params.proyectoId,
  );

  if (!evaluacion.elegible) {
    return {
      aplicado: false,
      motivo: evaluacion.motivo,
      confidenceScore: evaluacion.confidenceScore,
      totalUsd: evaluacion.totalUsd,
    };
  }

  const { data: inspections, error } = await supabase
    .from('quality_inspections')
    .select('id')
    .eq('invoice_id', params.purchaseInvoiceId)
    .eq('status', 'PENDIENTE');

  if (error) {
    return { aplicado: false, motivo: error.message };
  }

  let aprobadas = 0;
  for (const insp of inspections ?? []) {
    await approveQualityInspection(supabase, String(insp.id), params.inspectorId ?? null);
    aprobadas += 1;
  }

  return {
    aplicado: true,
    confidenceScore: evaluacion.confidenceScore,
    totalUsd: evaluacion.totalUsd,
    inspeccionesAprobadas: aprobadas,
  };
}

/** Construye payload OCR a partir del formulario de registro manual/app. */
export function buildExtractedFromProcurementForm(input: {
  invoice_number: string;
  supplier_rif: string;
  supplier_name: string;
  date: string;
  total_amount: number;
  items: Array<{
    description: string;
    item_code: string;
    unit: string;
    quantity: number;
    unit_price: number;
  }>;
  confidence_score?: number;
}): ExtractedPurchaseInvoice & { confidence_score?: number } {
  return {
    invoice_number: input.invoice_number,
    supplier_rif: input.supplier_rif,
    supplier_name: input.supplier_name,
    date: input.date,
    total_amount: input.total_amount,
    items: input.items.map((it) => ({
      description: it.description,
      item_code: it.item_code,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
    })),
    confidence_score: input.confidence_score,
  };
}
