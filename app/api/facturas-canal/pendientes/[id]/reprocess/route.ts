import { NextResponse } from 'next/server';
import { processInvoiceFromCanal } from '@/lib/canal/processInvoiceFromCanal';
import { descargarArchivosPendienteCanal } from '@/lib/canal/documentPartsPendiente';
import { resetearAvisoErrorCargaFactura } from '@/lib/telegram/avisoErrorCargaFactura';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id?: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

function idFromParams(params: { id?: string }): string | null {
  const id = params.id?.trim();
  return id && id !== 'undefined' ? id : null;
}

type PendienteRow = {
  id: string;
  estado: string;
  canal: string | null;
  chat_id: string | null;
  document_storage_path: string | null;
  document_mime_type: string | null;
  document_file_name: string | null;
  document_parts?: unknown;
};

/** Reprocesa OCR de una sola factura pendiente existente (sin crear nuevo registro). */
export async function POST(_req: Request, ctx: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar']);
  if (!acceso.ok) return acceso.response;

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const supabase = admin.client;

  try {
    const id = idFromParams(await resolveParams(ctx.params));
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }

    let { data: rowRaw, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select(
        'id,estado,canal,chat_id,document_storage_path,document_mime_type,document_file_name,document_parts',
      )
      .eq('id', id)
      .maybeSingle();
    if (error && /document_parts|PGRST204|schema cache/i.test(error.message)) {
      const retry = await supabase
        .from('ci_facturas_canal_pendientes')
        .select(
          'id,estado,canal,chat_id,document_storage_path,document_mime_type,document_file_name',
        )
        .eq('id', id)
        .maybeSingle();
      rowRaw = retry.data as typeof rowRaw;
      error = retry.error;
    }

    const row = rowRaw as PendienteRow | null;
    if (error || !row) {
      return NextResponse.json({ error: error?.message ?? 'Factura no encontrada' }, { status: 404 });
    }

    if (!['error', 'pendiente', 'procesando'].includes(row.estado)) {
      return NextResponse.json(
        { error: `Estado ${row.estado} no permite reproceso.` },
        { status: 400 },
      );
    }

    if (!row.document_storage_path && !row.document_parts) {
      return NextResponse.json(
        { error: 'No hay archivo en storage para reprocesar.' },
        { status: 400 },
      );
    }

    let archivos;
    try {
      archivos = await descargarArchivosPendienteCanal(supabase, row);
    } catch (dlErr) {
      return NextResponse.json(
        {
          error:
            dlErr instanceof Error ? dlErr.message : 'No se pudo descargar archivo para reproceso.',
        },
        { status: 400 },
      );
    }
    if (archivos.length === 0) {
      return NextResponse.json(
        { error: 'No hay archivo en storage para reprocesar.' },
        { status: 400 },
      );
    }

    await resetearAvisoErrorCargaFactura(supabase, row.id);

    const primario = archivos[0];
    await processInvoiceFromCanal({
      canal: (row.canal as 'telegram' | 'whatsapp') ?? 'telegram',
      pendingId: row.id,
      chatId: row.chat_id ?? 'reprocess',
      buffer: primario.buffer,
      mimeType: primario.mimeType,
      fileName: primario.fileName,
      archivos,
      sendReply: async () => {},
    });

    const { data: updated } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('id,estado,mensaje_error,updated_at')
      .eq('id', row.id)
      .single();

    return NextResponse.json({
      success: true,
      pending: updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al reprocesar factura';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

