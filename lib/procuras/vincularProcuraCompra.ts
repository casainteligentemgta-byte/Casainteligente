import type { SupabaseClient } from '@supabase/supabase-js';

export type ResultadoVinculoProcuraCompra = {
  ok: boolean;
  vinculado: boolean;
  procuraId?: string;
  ticket?: string;
  desviacionUsd?: number;
  error?: string;
};

/** D-05/D-06: enlaza procura con purchase_invoice y calcula desviacion_usd. */
export async function vincularProcuraCompraContabilidad(
  supabase: SupabaseClient,
  params: {
    purchaseInvoiceId: string;
    procuraId?: string | null;
    contabilidadCompraId?: string | null;
    autoMatch?: boolean;
  },
): Promise<ResultadoVinculoProcuraCompra> {
  const pi = params.purchaseInvoiceId.trim();
  if (!pi) return { ok: true, vinculado: false };

  const { data, error } = await supabase.rpc(
    'ci_vincular_procura_compra' as 'ci_registrar_ingreso_manual_campo',
    {
      p_purchase_invoice_id: pi,
      p_procura_id: params.procuraId?.trim() || null,
      p_contabilidad_compra_id: params.contabilidadCompraId?.trim() || null,
      p_auto_match: params.autoMatch !== false,
    } as never,
  );

  if (error) {
    const msg = error.message ?? 'Error al vincular procura';
    if (/ci_vincular_procura_compra|procura_id|does not exist/i.test(msg)) {
      return {
        ok: false,
        vinculado: false,
        error: 'RPC ci_vincular_procura_compra no disponible. Aplique migración 236.',
      };
    }
    return { ok: false, vinculado: false, error: msg };
  }

  const row = (
    data as
      | Array<{
          procura_id: string;
          ticket: string;
          desviacion_usd: number | null;
          vinculado: boolean;
        }>
      | null
  )?.[0];

  if (!row?.vinculado) {
    return { ok: true, vinculado: false };
  }

  return {
    ok: true,
    vinculado: true,
    procuraId: String(row.procura_id),
    ticket: row.ticket,
    desviacionUsd:
      row.desviacion_usd != null && Number.isFinite(Number(row.desviacion_usd))
        ? Number(row.desviacion_usd)
        : undefined,
  };
}

/** Sync contable vía RPC Postgres (D-07 helper). */
export async function sincronizarContabilidadTrasInventarioRpc(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<{ compraFacturaId: string | null; rpcOk: boolean }> {
  const pi = purchaseInvoiceId.trim();
  if (!pi) return { compraFacturaId: null, rpcOk: false };

  const { data, error } = await supabase.rpc(
    'ci_sincronizar_contabilidad_tras_inventario' as 'ci_registrar_ingreso_manual_campo',
    { p_purchase_invoice_id: pi } as never,
  );

  if (error) {
    if (/ci_sincronizar_contabilidad_tras_inventario|does not exist/i.test(error.message ?? '')) {
      return { compraFacturaId: null, rpcOk: false };
    }
    throw new Error(error.message);
  }

  return {
    compraFacturaId: data != null ? String(data) : null,
    rpcOk: true,
  };
}
