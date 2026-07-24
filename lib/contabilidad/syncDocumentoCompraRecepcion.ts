import type { SupabaseClient } from '@supabase/supabase-js';

export type DocumentoCompraResuelto = {
  storagePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  origen: 'compra' | 'recepcion' | null;
};

/** Obtiene la ruta del archivo en Storage desde la compra o la factura de recepción vinculada. */
export async function resolverDocumentoCompra(
  supabase: SupabaseClient,
  params: {
    compraId?: string;
    purchaseInvoiceId?: string | null;
    documentStoragePath?: string | null;
    documentFileName?: string | null;
  },
): Promise<DocumentoCompraResuelto> {
  let storagePath = params.documentStoragePath?.trim() || null;
  let fileName = params.documentFileName?.trim() || null;
  let mimeType: string | null = null;
  let origen: DocumentoCompraResuelto['origen'] = storagePath ? 'compra' : null;

  const invoiceId = params.purchaseInvoiceId?.trim();
  if (!storagePath && invoiceId) {
    const { data: inv, error } = await supabase
      .from('purchase_invoices')
      .select('document_storage_path, document_file_name, document_mime_type')
      .eq('id', invoiceId)
      .maybeSingle();
    if (error) throw error;
    storagePath = inv?.document_storage_path?.trim() || null;
    fileName = fileName ?? inv?.document_file_name ?? null;
    mimeType = inv?.document_mime_type ?? null;
    if (storagePath) origen = 'recepcion';
  }

  return { storagePath, fileName, mimeType, origen };
}

/** Copia ruta/nombre del documento a `contabilidad_compras` si faltaba (p. ej. foto tomada en recepción). */
export async function sincronizarDocumentoEnCompra(
  supabase: SupabaseClient,
  compraId: string,
  doc: Pick<DocumentoCompraResuelto, 'storagePath' | 'fileName'>,
): Promise<void> {
  if (!doc.storagePath?.trim() || !compraId.trim()) return;

  const { error } = await supabase
    .from('contabilidad_compras')
    .update({
      document_storage_path: doc.storagePath.trim(),
      document_file_name: doc.fileName?.trim() || null,
    })
    .eq('id', compraId.trim());

  if (error) {
    console.warn('[sincronizarDocumentoEnCompra]', error.message);
  }
}
