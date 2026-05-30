import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mensajeLineasSinMaterialSku,
  resolverMaterialIdLineasCompra,
} from '@/lib/almacen/resolverMaterialIdPorSku';
import { registrarCompraInventario } from '@/lib/almacen/registrarCompraInventario';

export type ResultadoIngresoAlmacenCanal = {
  success: boolean;
  compraFacturaId?: string;
  yaExistia?: boolean;
  error?: string;
};

/**
 * Registra compras_facturas + stock tras confirmar compra contable (migr. 180).
 */
export async function ingresoAlmacenDesdePendienteCanal(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<ResultadoIngresoAlmacenCanal> {
  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id,purchase_invoice_id,ubicacion_destino_id')
    .eq('id', pendingId)
    .maybeSingle();

  if (pErr) return { success: false, error: pErr.message };
  if (!pendiente?.purchase_invoice_id) {
    return { success: false, error: 'La compra aún no está confirmada en contabilidad.' };
  }

  const purchaseInvoiceId = String(pendiente.purchase_invoice_id);
  const ubicacionDestinoId = String(pendiente.ubicacion_destino_id ?? '').trim();

  const { data: existente } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('purchase_invoice_id', purchaseInvoiceId)
    .maybeSingle();

  if (existente?.id) {
    return {
      success: true,
      yaExistia: true,
      compraFacturaId: String(existente.id),
    };
  }

  const { data: compra, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,ubicacion_destino_id',
    )
    .eq('purchase_invoice_id', purchaseInvoiceId)
    .maybeSingle();

  if (cErr || !compra) {
    return {
      success: false,
      error: 'No se encontró la compra en contabilidad para este documento.',
    };
  }

  const resuelto = await resolverMaterialIdLineasCompra(supabase, String(compra.id));
  const lineasInventario = resuelto.lineas;

  if (!lineasInventario.length) {
    const detalle = mensajeLineasSinMaterialSku(resuelto.sinMatch);
    return {
      success: false,
      error: detalle
        ? `${detalle} Asigne item_code (SKU) en las líneas.`
        : 'La compra no tiene materiales vinculados para inventario.',
    };
  }

  const destino = String(compra.ubicacion_destino_id ?? ubicacionDestinoId).trim();
  if (!destino) {
    return { success: false, error: 'La compra no tiene almacén de destino.' };
  }

  try {
    const result = await registrarCompraInventario(supabase, {
      ubicacionDestinoId: destino,
      numeroFactura: String(compra.invoice_number ?? 'S/N'),
      proveedorRif: String(compra.supplier_rif ?? 'S/R'),
      proveedorNombre: String(compra.supplier_name ?? 'Proveedor'),
      fechaEmision: String(compra.fecha ?? new Date().toISOString().slice(0, 10)),
      total: Number(compra.total_amount ?? 0),
      purchaseInvoiceId,
      lineas: lineasInventario,
    });

    return {
      success: true,
      yaExistia: false,
      compraFacturaId: result.compraFacturaId,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Error al registrar ingreso',
    };
  }
}
