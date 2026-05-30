import { NextResponse } from 'next/server';
import { createProcurementDocumentSignedUrl } from '@/lib/almacen/procurementDocumentStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { data, error } = await admin.client
      .from('ci_facturas_canal_pendientes')
      .select('document_storage_path, document_file_name, document_mime_type')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    const row = data as {
      document_storage_path: string | null;
      document_file_name: string | null;
      document_mime_type: string | null;
    } | null;
    if (!row?.document_storage_path?.trim()) {
      return NextResponse.json(
        { error: 'Sin documento en Storage para esta factura de canal.', code: 'SIN_DOCUMENTO' },
        { status: 404 },
      );
    }

    let url: string;
    try {
      url = await createProcurementDocumentSignedUrl(
        admin.client,
        row.document_storage_path.trim(),
      );
    } catch (storageErr) {
      const msg = storageErr instanceof Error ? storageErr.message : '';
      const notFound = /not found|object not found|ya no está en Storage/i.test(msg);
      return NextResponse.json(
        {
          error: msg || 'No se pudo abrir el documento.',
          code: notFound ? 'ARCHIVO_NO_EN_BUCKET' : 'STORAGE_ERROR',
        },
        { status: notFound ? 404 : 500 },
      );
    }

    return NextResponse.json({
      url,
      mimeType: row.document_mime_type ?? null,
      fileName: row.document_file_name ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener documento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
