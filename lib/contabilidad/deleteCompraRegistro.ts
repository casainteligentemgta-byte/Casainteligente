import type { SupabaseClient } from '@supabase/supabase-js';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';

export function formatDeleteCompraError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : 'No se pudo eliminar la compra.';

  if (/purchase_details_material_id_fkey|23503|foreign key/i.test(raw)) {
    return `${raw} — Ejecute la migración 142 en Supabase y vuelva a intentar (borrado en orden: contabilidad → detalle factura → material).`;
  }
  return raw;
}

/**
 * Elimina la compra contable y la recepción asociada (factura, cuarentena, materiales en cuarentena).
 * No permite borrar si algún ítem ya fue aprobado e ingresó a stock disponible.
 */
export async function deleteCompraRegistro(
  supabase: SupabaseClient,
  compraId: string
): Promise<void> {
  const { data: compra, error: compraErr } = await supabase
    .from('contabilidad_compras')
    .select('id, purchase_invoice_id, invoice_number')
    .eq('id', compraId)
    .single();

  if (compraErr || !compra) {
    throw new Error('Compra no encontrada.');
  }

  const invoiceId = compra.purchase_invoice_id;
  if (!invoiceId) {
    const { error } = await supabase.from('contabilidad_compras').delete().eq('id', compraId);
    if (error) throw error;
    return;
  }

  const { data: inspections, error: inspErr } = await supabase
    .from('quality_inspections')
    .select('id, status, material_id')
    .eq('invoice_id', invoiceId);

  if (inspErr) throw inspErr;

  const aprobados = (inspections ?? []).filter((i) => i.status === 'APROBADO');
  if (aprobados.length > 0) {
    throw new Error(
      'No se puede borrar: hay material que ya fue aprobado e ingresó al stock. Revierta en cuarentena si fue un error.'
    );
  }

  const { data: invoice, error: invErr } = await supabase
    .from('purchase_invoices')
    .select('id, document_storage_path')
    .eq('id', invoiceId)
    .single();

  if (invErr || !invoice) {
    throw new Error('Factura de compra no encontrada.');
  }

  const materialIds = Array.from(
    new Set((inspections ?? []).map((i) => i.material_id).filter(Boolean) as string[])
  );

  /** Contabilidad y líneas primero (referencian purchase_details). */
  const { error: delCompraErr } = await supabase
    .from('contabilidad_compras')
    .delete()
    .eq('id', compraId);
  if (delCompraErr) throw delCompraErr;

  const { error: delInspErr } = await supabase
    .from('quality_inspections')
    .delete()
    .eq('invoice_id', invoiceId);
  if (delInspErr) throw delInspErr;

  const { error: delDetailsErr } = await supabase
    .from('purchase_details')
    .delete()
    .eq('invoice_id', invoiceId);
  if (delDetailsErr) throw delDetailsErr;

  if (materialIds.length > 0) {
    const { error: delMatErr } = await supabase
      .from('global_inventory')
      .delete()
      .in('id', materialIds);
    if (delMatErr) throw delMatErr;
  }

  const { error: delInvErr } = await supabase
    .from('purchase_invoices')
    .delete()
    .eq('id', invoiceId);
  if (delInvErr) throw delInvErr;

  if (invoice.document_storage_path) {
    const { error: storageErr } = await supabase.storage
      .from(PROCUREMENT_DOCUMENTS_BUCKET)
      .remove([invoice.document_storage_path]);
    if (storageErr) {
      console.warn('[deleteCompra] no se pudo borrar archivo en storage:', storageErr.message);
    }
  }
}
