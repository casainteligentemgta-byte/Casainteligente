import type { SupabaseClient } from '@supabase/supabase-js';
import {
  intentarCompletarPurchaseInvoice,
  revisarCuarentenaRechazoTotal,
  sincronizarContabilidadTrasInventarioCompra,
} from '@/lib/contabilidad/sincronizarLogisticaCompraContable';

/** Tras aprobar/rechazar: sincroniza contabilidad y cierra factura de compra si aplica. */
export async function finalizarLiberacionCuarentena(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  opts?: { sincronizarInventario?: boolean },
): Promise<void> {
  const invId = purchaseInvoiceId.trim();
  if (!invId) return;

  if (opts?.sincronizarInventario !== false) {
    await sincronizarContabilidadTrasInventarioCompra(supabase, invId);
  }

  await intentarCompletarPurchaseInvoice(supabase, invId);
  await revisarCuarentenaRechazoTotal(supabase, invId);
}
