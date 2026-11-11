import { NextResponse } from 'next/server';
import { createProcurementDocumentSignedUrl } from '@/lib/almacen/procurementDocumentStorage';
import { archivosPendienteCanal } from '@/lib/canal/documentPartsPendiente';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar', 'cco.ver']);
  if (!acceso.ok) return acceso.response;

  try {
    const { id } = await ctx.params;
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    let { data, error } = await admin.client
      .from('ci_facturas_canal_pendientes')
      .select('document_storage_path, document_file_name, document_mime_type, document_parts')
      .eq('id', id)
      .maybeSingle();
    if (error && /document_parts|PGRST204|schema cache/i.test(error.message)) {
      const retry = await admin.client
        .from('ci_facturas_canal_pendientes')
        .select('document_storage_path, document_file_name, document_mime_type')
        .eq('id', id)
        .maybeSingle();
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error) throw error;
    const row = data as {
      document_storage_path: string | null;
      document_file_name: string | null;
      document_mime_type: string | null;
      document_parts?: unknown;
    } | null;
    const archivos = row ? archivosPendienteCanal(row) : [];
    if (archivos.length === 0) {
      return NextResponse.json(
        { error: 'Sin documento en Storage para esta factura de canal.', code: 'SIN_DOCUMENTO' },
        { status: 404 },
      );
    }

    const firmar = async (storagePath: string) => {
      try {
        const url = await createProcurementDocumentSignedUrl(admin.client, storagePath);
        return { url, error: null as string | null };
      } catch (storageErr) {
        const msg = storageErr instanceof Error ? storageErr.message : '';
        return { url: null as string | null, error: msg };
      }
    };

    const firmados = [];
    for (const a of archivos) {
      const r = await firmar(a.storagePath);
      if (!r.url) {
        const notFound = /not found|object not found|ya no está en Storage/i.test(r.error ?? '');
        if (firmados.length === 0) {
          return NextResponse.json(
            {
              error: r.error || 'No se pudo abrir el documento.',
              code: notFound ? 'ARCHIVO_NO_EN_BUCKET' : 'STORAGE_ERROR',
            },
            { status: notFound ? 404 : 500 },
          );
        }
        continue;
      }
      firmados.push({
        url: r.url,
        mimeType: a.mimeType,
        fileName: a.fileName,
      });
    }

    const primero = firmados[0];
    return NextResponse.json({
      url: primero.url,
      mimeType: primero.mimeType,
      fileName: primero.fileName,
      parts: firmados,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener documento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
