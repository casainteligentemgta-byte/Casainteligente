import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { calcularConfidenceScoreOcr, cumpleUmbralFastTrack } from '@/lib/canal/calcularConfidenceScoreOcr';
import { resolverLimiteFastTrackUsd } from '@/lib/canal/limiteFastTrackUsd';
import { resolverMontosCompraBimonetario } from '@/lib/contabilidad/comprasBimonetario';
import { normSkuCodigo } from '@/lib/almacen/resolverMaterialIdPorSku';
import { tieneRecepcionesCampoSinConciliar } from '@/lib/almacen/tieneRecepcionesCampoSinConciliar';

export type ResultadoEvalFastTrack = {
  elegible: boolean;
  confidenceScore: number;
  totalUsd: number;
  skuCoinciden: boolean;
  motivo?: string;
  materialIds: string[];
};

export async function evaluarFastTrackFactura(
  supabase: SupabaseClient,
  extracted: ExtractedPurchaseInvoice & { confidence_score?: number },
  proyectoId?: string | null,
): Promise<ResultadoEvalFastTrack> {
  const confidenceScore = calcularConfidenceScoreOcr(
    extracted,
    extracted.confidence_score,
  );

  const items = extracted.items ?? [];
  const codigos = items
    .map((i) => String(i.item_code ?? '').trim())
    .filter(Boolean);

  if (!cumpleUmbralFastTrack(confidenceScore)) {
    return {
      elegible: false,
      confidenceScore,
      totalUsd: 0,
      skuCoinciden: false,
      motivo: `Confianza OCR ${confidenceScore}% ≤ 95%`,
      materialIds: [],
    };
  }

  if (!codigos.length || codigos.length !== items.length) {
    return {
      elegible: false,
      confidenceScore,
      totalUsd: 0,
      skuCoinciden: false,
      motivo: 'Faltan códigos SKU en alguna línea',
      materialIds: [],
    };
  }

  const fecha = (extracted.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const totalBs =
    extracted.total_amount != null && Number(extracted.total_amount) > 0
      ? Number(extracted.total_amount)
      : items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);

  const montos = await resolverMontosCompraBimonetario({
    montoTotal: totalBs,
    moneda: 'VES',
    fecha,
  });
  const totalUsd = montos.montoUsd;
  const limiteUsd = await resolverLimiteFastTrackUsd(supabase, proyectoId);

  if (!(totalUsd > 0 && totalUsd < limiteUsd)) {
    return {
      elegible: false,
      confidenceScore,
      totalUsd,
      skuCoinciden: false,
      motivo: `Monto ${totalUsd.toFixed(2)} USD fuera de fast-track (< $${limiteUsd.toFixed(2)})`,
      materialIds: [],
    };
  }

  if (proyectoId) {
    const hayFrm = await tieneRecepcionesCampoSinConciliar(supabase, {
      proyectoId,
      supplierRif: extracted.supplier_rif,
      supplierName: extracted.supplier_name,
    });
    if (hayFrm) {
      return {
        elegible: false,
        confidenceScore,
        totalUsd,
        skuCoinciden: false,
        motivo: 'Existe recepción FRM sin conciliar para este proveedor — use conciliación manual',
        materialIds: [],
      };
    }
  }

  const { data: catalogo, error } = await supabase
    .from('global_inventory')
    .select('id, sap_code')
    .not('sap_code', 'is', null);

  if (error) {
    return {
      elegible: false,
      confidenceScore,
      totalUsd,
      skuCoinciden: false,
      motivo: error.message,
      materialIds: [],
    };
  }

  const porSku = new Map<string, string>();
  for (const row of catalogo ?? []) {
    const sku = normSkuCodigo(String((row as { sap_code?: string }).sap_code ?? ''));
    const id = String((row as { id: string }).id);
    if (sku) porSku.set(sku, id);
  }

  const materialIds: string[] = [];
  for (const cod of codigos) {
    const matId = porSku.get(normSkuCodigo(cod));
    if (!matId) {
      return {
        elegible: false,
        confidenceScore,
        totalUsd,
        skuCoinciden: false,
        motivo: `SKU ${cod} no coincide con global_inventory activo`,
        materialIds: [],
      };
    }
    materialIds.push(matId);
  }

  return {
    elegible: true,
    confidenceScore,
    totalUsd,
    skuCoinciden: true,
    materialIds,
  };
}
