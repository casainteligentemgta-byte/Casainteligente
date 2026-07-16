import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const params = await Promise.resolve(ctx.params);
  const id = String(params.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { data, error } = await gate.admin
    .from('ci_legal_plantillas')
    .select('*')
    .eq('id', id)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: 'Ejecute la migración 271_ci_legal_documentos.sql en Supabase SQL Editor.',
      },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }

  // Globales (org_id null) o del org actual
  if (data.org_id && data.org_id !== gate.acceso.orgId) {
    return NextResponse.json({ error: 'Sin acceso a esta plantilla' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, plantilla: data });
}
