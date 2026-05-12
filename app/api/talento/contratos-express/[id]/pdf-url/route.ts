import { NextResponse } from 'next/server';
import { signedUrlContratoLaboralBucket } from '@/lib/talento/contratoLaboralRegistroStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/** GET — URL firmada temporal para descargar el PDF del contrato express desde Storage. */
export async function GET(_req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: row, error } = await admin.client
    .from('ci_contratos_express')
    .select('id,pdf_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'Registro no encontrado' }, { status: 404 });
  }

  const path = String((row as { pdf_storage_path?: string }).pdf_storage_path ?? '').trim();
  if (!path) {
    return NextResponse.json({ error: 'Sin ruta de PDF' }, { status: 400 });
  }

  const signed = await signedUrlContratoLaboralBucket(admin.client, path, 3600);
  if ('error' in signed) {
    return NextResponse.json({ error: signed.error }, { status: 500 });
  }

  return NextResponse.json({ url: signed.url, expires_sec: 3600 });
}
