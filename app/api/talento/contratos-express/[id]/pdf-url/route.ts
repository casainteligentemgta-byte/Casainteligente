import { NextResponse } from 'next/server';
import { signedUrlContratoLaboralBucket } from '@/lib/talento/contratoLaboralRegistroStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function isMissingColumn(msg: string): boolean {
  return /column|does not exist|42703/i.test(msg);
}

type ExpressPathsRow = {
  id?: string;
  pdf_storage_path?: string | null;
  pdf_firmado_storage_path?: string | null;
};

/** GET — URL firmada temporal (`expires_sec`). `?doc=firmado` usa el archivo subido tras firma del obrero. */
export async function GET(req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const url = new URL(req.url);
  const wantFirmado = url.searchParams.get('doc')?.toLowerCase() === 'firmado';

  let row: ExpressPathsRow | null = null;
  let selErr: { message: string } | null = null;

  const full = await admin.client
    .from('ci_contratos_express')
    .select('id,pdf_storage_path,pdf_firmado_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (full.error && isMissingColumn(full.error.message)) {
    const lite = await admin.client.from('ci_contratos_express').select('id,pdf_storage_path').eq('id', id).maybeSingle();
    row = (lite.data as ExpressPathsRow | null) ?? null;
    selErr = lite.error;
  } else {
    row = (full.data as ExpressPathsRow | null) ?? null;
    selErr = full.error;
  }

  if (selErr || !row) {
    return NextResponse.json({ error: selErr?.message ?? 'Registro no encontrado' }, { status: 404 });
  }

  let path: string;
  if (wantFirmado) {
    path = String(row.pdf_firmado_storage_path ?? '').trim();
    if (!path) {
      return NextResponse.json(
        { error: 'Aún no hay documento firmado subido para este contrato express.' },
        { status: 404 },
      );
    }
  } else {
    path = String(row.pdf_storage_path ?? '').trim();
    if (!path) {
      return NextResponse.json({ error: 'Sin ruta de PDF' }, { status: 400 });
    }
  }

  const signed = await signedUrlContratoLaboralBucket(admin.client, path, 3600);
  if ('error' in signed) {
    return NextResponse.json({ error: signed.error }, { status: 500 });
  }

  return NextResponse.json({ url: signed.url, expires_sec: 3600, doc: wantFirmado ? 'firmado' : 'generado' });
}
