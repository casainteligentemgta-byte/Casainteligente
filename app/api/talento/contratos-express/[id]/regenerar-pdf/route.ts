import { NextResponse } from 'next/server';
import { regenerarYPersistirPdfContratoExpress } from '@/lib/rrhh/expressContratoPdfBuffer';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST — Regenera el PDF del contrato express con los datos actuales de la fila
 * y lo sobrescribe en Storage. No crea un contrato nuevo.
 */
export async function POST(_req: Request, context: { params: { id: string } }) {
  const { requirePermisoRrhhObra } = await import('@/lib/rrhh/requirePermisoRrhh');
  const gate = await requirePermisoRrhhObra();
  if (!gate.ok) return gate.response;

  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const out = await regenerarYPersistirPdfContratoExpress(admin.client, id);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    ok: true,
    id,
    pdf_storage_path: out.pdf_storage_path,
    signed_url: out.signed_url,
  });
}
