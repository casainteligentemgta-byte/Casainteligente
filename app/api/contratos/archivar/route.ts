import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { archivarContratoRrhh } from '@/lib/contratos/rrhhContratoFlow';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST multipart — RRHH sube escaneo firmado + ubicación archivo físico + confirmación digital.
 */
export async function POST(req: Request) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Debe iniciar sesión (RRHH / Admin)' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
  }

  const contratoId = String(form.get('contrato_id') ?? form.get('contratoId') ?? '').trim();
  const ubicacion = String(form.get('ubicacion_archivo_real') ?? '').trim();
  const copiaOk =
    form.get('copia_digital_indexada') === 'true' ||
    form.get('copia_digital_indexada') === '1' ||
    form.get('copia_digital_indexada') === 'on';
  const proyectoId = String(form.get('proyecto_id') ?? form.get('proyectoId') ?? '').trim();
  const cedula = String(form.get('cedula') ?? '').trim();

  const file = form.get('archivo');
  if (!(file instanceof Blob) || file.size < 1) {
    return NextResponse.json({ error: 'Adjunte el PDF escaneado en el campo «archivo»' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 15 MB)' }, { status: 400 });
  }

  const mime = (file.type ?? 'application/pdf').toLowerCase();
  const allowed =
    mime === 'application/pdf' || mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp';
  if (!allowed) {
    return NextResponse.json({ error: 'Solo PDF o imagen (JPG, PNG, WebP)' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const buf = Buffer.from(await file.arrayBuffer());
  const out = await archivarContratoRrhh(admin.client, {
    contratoId,
    archivo: buf,
    mime: mime === 'application/pdf' ? 'application/pdf' : mime,
    ubicacionArchivoReal: ubicacion,
    copiaDigitalIndexada: copiaOk,
    archivadoPorUsuarioId: user.id,
    proyectoId,
    cedula,
  });

  if ('error' in out) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    ok: true,
    estado_contrato: 'firmado_y_archivado',
    empleado_estado_proceso: 'contratado_activo',
    empleado_id: out.empleadoId,
  });
}
