import { NextResponse } from 'next/server';
import { subirPdfFirmadoContratoExpress } from '@/lib/talento/subirPdfFirmadoContratoExpress';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * POST — Sube PDF o imagen (escaneo) del contrato firmado por el obrero; guarda ruta en `ci_contratos_express`.
 * Cuerpo: `multipart/form-data` con campo `file`.
 */
export async function POST(req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Adjunte el archivo en el campo «file».' }, { status: 400 });
  }

  const filename =
    typeof File !== 'undefined' && file instanceof File
      ? file.name
      : String(form.get('filename') ?? '') || null;

  const out = await subirPdfFirmadoContratoExpress(admin.client, id, file, { filename });
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    ok: true,
    pdf_firmado_storage_path: out.pdf_firmado_storage_path,
    pdf_firmado_subido_at: out.pdf_firmado_subido_at,
  });
}
