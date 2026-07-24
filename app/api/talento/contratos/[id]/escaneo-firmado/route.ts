import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BUCKET_CONTRATOS_OBREROS } from '@/lib/talento/contratoLaboralRegistroStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * POST multipart: campo `archivo` (PDF o imagen) — escaneo del contrato firmado en físico.
 * Requiere sesión. Sube a Storage y registra ruta en `ci_contratos_empleado_obra`.
 */
export async function POST(req: Request, context: { params: { id: string } }) {
  const id = context.params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de contrato' }, { status: 400 });
  }

  const supabaseAuth = await createClient();
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabaseAuth.auth.getUser();
  if (authErr || !authUser) {
    return NextResponse.json({ error: 'Debe iniciar sesión para cargar el escaneo.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
  }

  const file = form.get('archivo');
  if (!(file instanceof Blob) || file.size < 1) {
    return NextResponse.json({ error: 'Adjunte el archivo en el campo «archivo».' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el tamaño máximo permitido (12 MB).' }, { status: 400 });
  }

  const mime = (file.type ?? '').toLowerCase();
  const allowed =
    mime === 'application/pdf' ||
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/webp';
  if (!allowed) {
    return NextResponse.json({ error: 'Solo se admiten PDF, JPEG, PNG o WebP.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `laboral/${id}/escaneo-firmado-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: up } = await admin.client.storage.from(BUCKET_CONTRATOS_OBREROS).upload(path, buf, {
    contentType: mime || 'application/octet-stream',
    upsert: true,
  });
  if (up) {
    console.error('[escaneo-firmado] storage', up);
    return NextResponse.json({ error: up.message }, { status: 500 });
  }

  const ahora = new Date().toISOString();
  const { error: u2 } = await admin.client
    .from('ci_contratos_empleado_obra')
    .update({
      laboral_escaneo_firmado_storage_path: path,
      laboral_escaneo_firmado_at: ahora,
    } as never)
    .eq('id', id);

  if (u2) {
    console.error('[escaneo-firmado] update', u2);
    return NextResponse.json({ error: u2.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    laboral_escaneo_firmado_storage_path: path,
    laboral_escaneo_firmado_at: ahora,
    subido_por_usuario_id: authUser.id,
  });
}
