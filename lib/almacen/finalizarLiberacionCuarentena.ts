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
  opts?: {
    sincronizarInventario?: boolean;
    /**
     * false: quien llama cierra retiro y procura por su cuenta (el ingreso desde el canal
     * lo hace con las cantidades que contó el depositario).
     */
    cerrarCadena?: boolean;
  },
): Promise<void> {
  const invId = purchaseInvoiceId.trim();
  if (!invId) return;

  if (opts?.sincronizarInventario !== false) {
    await sincronizarContabilidadTrasInventarioCompra(supabase, invId);
  }

  await intentarCompletarPurchaseInvoice(supabase, invId);
  await revisarCuarentenaRechazoTotal(supabase, invId);

  // Cuarentena resuelta: cerrar retiro y marcar la procura como recibida (o cancelar el retiro).
  if (opts?.cerrarCadena === false) return;
  const { cerrarCadenaTrasCuarentena } = await import('@/lib/compras/cerrarCadenaTrasCuarentena');
  await cerrarCadenaTrasCuarentena(supabase, invId);
}
