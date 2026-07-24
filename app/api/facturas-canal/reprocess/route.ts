import { NextResponse } from 'next/server';
import { processInvoiceFromCanal } from '@/lib/canal/processInvoiceFromCanal';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/** Reintenta OCR en facturas con estado error / pendiente / procesando (solo dev/admin). */
export async function POST() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const supabase = admin.client;

  const { data: rows, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, document_storage_path, document_mime_type, document_file_name, chat_id')
    .in('estado', ['error', 'procesando', 'pendiente'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; estado?: string; error?: string }> = [];

  type CanalReprocessRow = {
    id: string;
    document_storage_path: string | null;
    document_mime_type: string | null;
    document_file_name: string | null;
    chat_id: string | null;
  };

  for (const row of (rows ?? []) as CanalReprocessRow[]) {
    if (!row.document_storage_path) {
      results.push({ id: row.id, ok: false, error: 'sin archivo' });
      continue;
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from(PROCUREMENT_DOCUMENTS_BUCKET)
      .download(row.document_storage_path);

    if (dlErr || !blob) {
      results.push({ id: row.id, ok: false, error: dlErr?.message ?? 'download' });
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    try {
      await processInvoiceFromCanal({
        canal: 'telegram',
        pendingId: row.id,
        chatId: row.chat_id ?? 'reprocess',
        buffer,
        mimeType: row.document_mime_type ?? 'image/jpeg',
        fileName: row.document_file_name ?? 'factura.jpg',
        sendReply: async () => {},
      });
      const { data: updated } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('estado')
        .eq('id', row.id)
        .single();
      const estado = (updated as { estado?: string } | null)?.estado;
      results.push({ id: row.id, ok: true, estado });
    } catch (e) {
      results.push({
        id: row.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
