import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createProcurementDocumentSignedUrl } from '@/lib/almacen/procurementDocumentStorage';

export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'ID de factura requerido.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('purchase_invoices')
      .select('document_storage_path, document_file_name, document_mime_type')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!row?.document_storage_path) {
      return NextResponse.json(
        { error: 'Esta factura no tiene documento adjunto.' },
        { status: 404 }
      );
    }

    let url: string;
    try {
      url = await createProcurementDocumentSignedUrl(
        supabase,
        row.document_storage_path,
      );
    } catch (storageErr) {
      const msg = storageErr instanceof Error ? storageErr.message : '';
      const notFound = /not found|object not found|ya no está en Storage/i.test(msg);
      return NextResponse.json(
        {
          error: msg || 'No se pudo abrir el documento.',
          code: notFound ? 'ARCHIVO_NO_EN_BUCKET' : 'STORAGE_ERROR',
          storagePath: row.document_storage_path,
        },
        { status: notFound ? 404 : 500 },
      );
    }

    return NextResponse.json({
      url,
      fileName: row.document_file_name,
      mimeType: row.document_mime_type,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al obtener el documento.';
    console.error('[GET procurement document]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
