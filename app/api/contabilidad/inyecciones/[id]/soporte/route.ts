import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';

export const dynamic = 'force-dynamic';

/** GET — URL firmada del comprobante de una inyección de capital. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const params = await Promise.resolve(ctx.params);
    const id = String(params?.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Falta id de inyección.' }, { status: 400 });
    }

    const { data, error } = await admin.client
      .from('ci_inyecciones_capital')
      .select('soporte_storage_path')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const path = String((data as { soporte_storage_path?: string } | null)?.soporte_storage_path ?? '').trim();
    if (!path) {
      return NextResponse.json({ error: 'Sin comprobante adjunto.' }, { status: 404 });
    }

    const { data: signed, error: sErr } = await admin.client.storage
      .from(PROCUREMENT_DOCUMENTS_BUCKET)
      .createSignedUrl(path, 3600);
    if (sErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: sErr?.message ?? 'No se pudo firmar el comprobante.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: signed.signedUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al abrir comprobante.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
