import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';

export type ResultadoConciliacionFrm = {
  compraId: string;
  purchaseInvoiceId: string;
  recepcionCampoId: string;
  yaExistia: boolean;
  actualizoProvisional?: boolean;
};

type RpcConciliacionFrm = {
  success?: boolean;
  error?: string;
  message?: string;
  compra_id?: string;
  purchase_invoice_id?: string;
  recepcion_campo_id?: string;
  ya_existia?: boolean;
  actualizo_provisional?: boolean;
};

/**
 * Amarra factura fiscal (canal) a un ingreso FRM ya en stock vía RPC atómica.
 * Si el FRM ya tiene compra provisional, actualiza montos sin duplicar inventario.
 */
export async function conciliarFrmConFacturaCanal(
  supabase: SupabaseClient,
  params: {
    facturaCanalPendienteId: string;
    recepcionCampoId: string;
    extractedOverride?: ExtractedCanalHeader;
    compraProvisionalId?: string;
    nroFacturaFiscal?: string;
    montoUsd?: number | null;
    montoVes?: number | null;
  },
): Promise<ResultadoConciliacionFrm> {
  const pendingId = params.facturaCanalPendienteId.trim();
  const recepcionId = params.recepcionCampoId.trim();
  if (!pendingId || !recepcionId) {
    throw new Error('Factura y recepción de campo son obligatorias.');
  }

  const { data, error } = await supabase.rpc('ci_conciliar_frm_con_factura_canal', {
    p_recepcion_campo_id: recepcionId,
    p_factura_canal_id: pendingId,
    p_extracted_override: params.extractedOverride ?? null,
    p_nro_factura_fiscal: params.nroFacturaFiscal?.trim() || null,
    p_monto_usd: params.montoUsd ?? null,
    p_monto_ves: params.montoVes ?? null,
    p_compra_provisional_id: params.compraProvisionalId?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (data ?? {}) as RpcConciliacionFrm;
  if (!row.success) {
    throw new Error(row.error?.trim() || 'Error en conciliación FRM.');
  }

  const compraId = String(row.compra_id ?? '').trim();
  const purchaseInvoiceId = String(row.purchase_invoice_id ?? '').trim();
  if (!compraId || !purchaseInvoiceId) {
    throw new Error('La conciliación no devolvió IDs de compra válidos.');
  }

  return {
    compraId,
    purchaseInvoiceId,
    recepcionCampoId: String(row.recepcion_campo_id ?? recepcionId),
    yaExistia: Boolean(row.ya_existia),
    actualizoProvisional: Boolean(row.actualizo_provisional),
  };
}
