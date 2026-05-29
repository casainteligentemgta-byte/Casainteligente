import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(params: { id?: string } | Promise<{ id?: string }>): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const id = p.id?.trim();
  return id && id !== 'undefined' ? id : null;
}

export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return NextResponse.json({ error: 'ID de inspección inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { data: inspRaw } = await admin.client
      .from('quality_inspections')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    const insp = inspRaw as { id: string; status: string } | null;

    if (!insp) {
      return NextResponse.json({ error: 'Inspección no encontrada.' }, { status: 404 });
    }
    if (insp.status !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Esta inspección ya fue procesada.' }, { status: 400 });
    }

    const { error } = await admin.client
      .from('quality_inspections')
      .update({ status: 'RECHAZADO', inspected_at: new Date().toISOString() } as never)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al rechazar inspección';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
