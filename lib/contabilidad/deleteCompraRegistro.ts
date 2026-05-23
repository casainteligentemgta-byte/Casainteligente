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
  if (/row-level security|policy|42501|permission denied/i.test(raw)) {
    return `${raw} — Falta permiso DELETE en Supabase. Ejecute la migración 150_compras_delete_policies.sql.`;
  }
  return raw;
}

export function normalizeInvoiceNumber(n: string): string {
  return String(n ?? '')
    .trim()
    .replace(/^#+/, '');
}

function invoiceNumberVariants(n: string): string[] {
  const base = normalizeInvoiceNumber(n);
  if (!base) return [];
  return Array.from(new Set([base, `#${base}`, n.trim()]));
}

type CompraRef = {
  id: string;
  purchase_invoice_id: string | null;
  invoice_number: string;
  supplier_rif?: string | null;
};

async function assertRowsDeleted(ids: string[] | undefined, contexto: string): Promise<void> {
  if (!ids?.length) {
    throw new Error(
      `No se pudo eliminar (${contexto}). Revise permisos RLS DELETE en Supabase (migración 150).`,
    );
  }
}

/**
 * Elimina una fila de contabilidad_compras por id y devuelve filas borradas.
 */
async function deleteContabilidadCompraRow(
  supabase: SupabaseClient,
  compraId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('contabilidad_compras')
    .delete()
    .eq('id', compraId)
    .select('id');
  if (error) throw error;
  await assertRowsDeleted(data?.map((r) => r.id), 'contabilidad_compras');
}

/**
 * Elimina la compra contable y la recepción asociada (factura, cuarentena, materiales en cuarentena).
 * No permite borrar si algún ítem ya fue aprobado e ingresó a stock disponible.
 */
async function deleteCompraPorId(
  supabase: SupabaseClient,
  compraId: string,
): Promise<{ materialYaEnStock: boolean }> {
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
    await deleteContabilidadCompraRow(supabase, compraId);
    return { materialYaEnStock: false };
  }

  const { data: inspections, error: inspErr } = await supabase
    .from('quality_inspections')
    .select('id, status, material_id')
    .eq('invoice_id', invoiceId);

  if (inspErr) throw inspErr;

  const aprobados = (inspections ?? []).filter((i) => i.status === 'APROBADO');
  const materialYaEnStock = aprobados.length > 0;

  const { data: invoice, error: invErr } = await supabase
    .from('purchase_invoices')
    .select('id, document_storage_path')
    .eq('id', invoiceId)
    .single();

  if (invErr || !invoice) {
    await deleteContabilidadCompraRow(supabase, compraId);
    return { materialYaEnStock };
  }

  const materialIds = Array.from(
    new Set((inspections ?? []).map((i) => i.material_id).filter(Boolean) as string[]),
  );

  await deleteContabilidadCompraRow(supabase, compraId);

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

  if (!materialYaEnStock && materialIds.length > 0) {
    const { error: delMatErr } = await supabase
      .from('global_inventory')
      .delete()
      .in('id', materialIds);
    if (delMatErr) throw delMatErr;
  }

  const { data: delInv, error: delInvErr } = await supabase
    .from('purchase_invoices')
    .delete()
    .eq('id', invoiceId)
    .select('id');
  if (delInvErr) throw delInvErr;
  if (!delInv?.length) {
    throw new Error('No se pudo eliminar la factura de recepción (purchase_invoices).');
  }

  if (invoice.document_storage_path) {
    const { error: storageErr } = await supabase.storage
      .from(PROCUREMENT_DOCUMENTS_BUCKET)
      .remove([invoice.document_storage_path]);
    if (storageErr) {
      console.warn('[deleteCompra] no se pudo borrar archivo en storage:', storageErr.message);
    }
  }

  return { materialYaEnStock };
}

/** Busca todas las compras con el mismo número de factura (duplicados en contabilidad). */
async function listarComprasMismaFactura(
  supabase: SupabaseClient,
  invoiceNumber: string,
  supplierRif?: string | null,
): Promise<CompraRef[]> {
  const variants = invoiceNumberVariants(invoiceNumber);
  if (!variants.length) return [];

  const { data, error } = await supabase
    .from('contabilidad_compras')
    .select('id, purchase_invoice_id, invoice_number, supplier_rif')
    .in('invoice_number', variants);

  if (error) throw error;

  const norm = normalizeInvoiceNumber(invoiceNumber);
  const rif = (supplierRif ?? '').trim().toUpperCase();

  return (data ?? []).filter((row) => {
    if (normalizeInvoiceNumber(row.invoice_number) !== norm) return false;
    if (rif && (row.supplier_rif ?? '').trim().toUpperCase() !== rif) return false;
    return true;
  }) as CompraRef[];
}

export type DeleteCompraResult = {
  deletedIds: string[];
  duplicateCount: number;
  /** Alguna compra tenía material ya aprobado en inventario (no se borró el ítem de stock). */
  materialPermaneceEnStock?: boolean;
};

/**
 * Elimina la compra indicada. Por defecto solo esa fila; opcionalmente duplicados mismo nº factura.
 */
export async function deleteCompraRegistro(
  supabase: SupabaseClient,
  compraId: string,
  options?: { incluirDuplicadosMismaFactura?: boolean },
): Promise<DeleteCompraResult> {
  const { data: seed, error: seedErr } = await supabase
    .from('contabilidad_compras')
    .select('id, invoice_number, supplier_rif')
    .eq('id', compraId)
    .maybeSingle();

  if (seedErr) throw seedErr;
  if (!seed) throw new Error('Compra no encontrada.');

  let uniqueIds = [compraId];

  if (options?.incluirDuplicadosMismaFactura) {
    const duplicados = await listarComprasMismaFactura(
      supabase,
      seed.invoice_number,
      seed.supplier_rif,
    );
    uniqueIds = Array.from(new Set(duplicados.map((d) => d.id)));
  }
  const deletedIds: string[] = [];
  let materialPermaneceEnStock = false;

  for (const id of uniqueIds) {
    const r = await deleteCompraPorId(supabase, id);
    if (r.materialYaEnStock) materialPermaneceEnStock = true;
    deletedIds.push(id);
  }

  return {
    deletedIds,
    duplicateCount: uniqueIds.length,
    materialPermaneceEnStock: materialPermaneceEnStock || undefined,
  };
}
