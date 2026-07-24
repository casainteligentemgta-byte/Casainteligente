import { NextResponse } from 'next/server';
import { contratoObreroPorToken } from '@/lib/talento/contratoObreroToken';
import { signedUrlContratoLaboralBucket } from '@/lib/talento/contratoLaboralRegistroStorage';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?contrato_id=&token=&tipo=contrato|constancia
 * Redirige a URL firmada de Storage (bucket contratos_obreros) para descarga por el obrero.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contratoId = (searchParams.get('contrato_id') ?? '').trim();
  const token = (searchParams.get('token') ?? '').trim();
  const tipo = (searchParams.get('tipo') ?? 'contrato').trim().toLowerCase();

  if (!contratoId || !token) {
    return NextResponse.json({ error: 'contrato_id y token requeridos' }, { status: 400 });
  }
  if (tipo !== 'contrato' && tipo !== 'constancia') {
    return NextResponse.json({ error: 'tipo debe ser contrato o constancia' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const v = await contratoObreroPorToken(admin.client, contratoId, token);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const { data: row, error: sel } = await admin.client
    .from('ci_contratos_empleado_obra')
    .select(
      'laboral_pdf_storage_path, laboral_constancia_aceptacion_storage_path, obrero_aceptacion_contrato_at',
    )
    .eq('id', v.contratoId)
    .maybeSingle();

  if (sel || !row) {
    return NextResponse.json({ error: sel?.message ?? 'Contrato no encontrado' }, { status: 404 });
  }

  const r = row as {
    laboral_pdf_storage_path?: string | null;
    laboral_constancia_aceptacion_storage_path?: string | null;
    obrero_aceptacion_contrato_at?: string | null;
  };

  const path =
    tipo === 'constancia'
      ? String(r.laboral_constancia_aceptacion_storage_path ?? '').trim()
      : String(r.laboral_pdf_storage_path ?? '').trim();

  if (tipo === 'constancia' && !r.obrero_aceptacion_contrato_at) {
    return NextResponse.json({ error: 'Aún no hay constancia: debe aceptar el contrato primero.' }, { status: 409 });
  }

  if (!path) {
    return NextResponse.json(
      {
        error:
          tipo === 'constancia'
            ? 'La constancia no está disponible. Contacte a RRHH.'
            : 'El PDF archivado no está disponible aún. Abra el contrato una vez en línea para generarlo, o contacte a RRHH.',
      },
      { status: 404 },
    );
  }

  const signed = await signedUrlContratoLaboralBucket(admin.client, path, 120);
  if ('error' in signed) {
    return NextResponse.json({ error: signed.error }, { status: 500 });
  }

  return NextResponse.redirect(signed.url, 302);
}
