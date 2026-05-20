import { createClient } from '@supabase/supabase-js';
import { extractPurchaseInvoiceFromFile } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';

export type CanalFactura = 'telegram' | 'whatsapp';

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Supabase no configurado');
  return createClient(url, key);
}

export async function processInvoiceFromCanal(params: {
  canal: CanalFactura;
  pendingId: string;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  sendReply: (text: string, html?: boolean) => Promise<void>;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const ext =
    params.fileName.split('.').pop()?.toLowerCase() ||
    (params.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
  const storagePath = `${params.canal}-pending/${params.pendingId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: true,
    });
  if (upErr) throw new Error(`Storage: ${upErr.message}`);

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'procesando',
      document_storage_path: storagePath,
      document_file_name: params.fileName,
      document_mime_type: params.mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  const base = baseUrlApp();
  const link = `${base}/contabilidad/compras/canal?pendiente=${params.pendingId}`;

  let extracted: Record<string, unknown> | null = null;
  let mensajeError: string | null = null;

  try {
    const { data, fromGemini, modelUsed } = await extractPurchaseInvoiceFromFile({
      buffer: params.buffer,
      mimeType: params.mimeType,
      fileName: params.fileName,
    });
    extracted = { ...data, fromGemini, modelUsed };
  } catch (e) {
    mensajeError = e instanceof Error ? e.message : 'Error OCR';
  }

  if (mensajeError || !extracted) {
    await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        estado: 'error',
        mensaje_error: mensajeError,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.pendingId);

    await params.sendReply(
      `❌ No pude leer la factura.\n${mensajeError ?? 'Error desconocido'}\n\n${link}`,
      false,
    );
    return;
  }

  const inv = extracted as {
    invoice_number?: string;
    supplier_name?: string;
    supplier_rif?: string;
    total_amount?: number | null;
    items?: unknown[];
  };

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'extraido',
      extracted,
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  const nItems = Array.isArray(inv.items) ? inv.items.length : 0;
  const html =
    params.canal === 'telegram'
      ? `✅ <b>Factura recibida</b>\n\n` +
        `📄 Nº: <code>${inv.invoice_number ?? '—'}</code>\n` +
        `🏢 ${inv.supplier_name ?? 'Proveedor'}\n` +
        `🆔 RIF: ${inv.supplier_rif ?? '—'}\n` +
        `💰 Total: ${inv.total_amount != null ? `${inv.total_amount} Bs` : '—'}\n` +
        `📦 Líneas: ${nItems}\n\n` +
        `Confirma en:\n<a href="${link}">${link}</a>`
      : null;

  const plain =
    `✅ Factura recibida\n\n` +
    `Nº: ${inv.invoice_number ?? '—'}\n` +
    `Proveedor: ${inv.supplier_name ?? '—'}\n` +
    `RIF: ${inv.supplier_rif ?? '—'}\n` +
    `Total: ${inv.total_amount != null ? `${inv.total_amount} Bs` : '—'}\n` +
    `Líneas: ${nItems}\n\n` +
    `Confirma en: ${link}`;

  await params.sendReply(html ?? plain, Boolean(html));
}
