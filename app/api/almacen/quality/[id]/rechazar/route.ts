import { NextResponse } from 'next/server';
import { finalizarLiberacionCuarentena } from '@/lib/almacen/finalizarLiberacionCuarentena';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };
type RejectBody = { motivo?: string };

async function resolveId(params: { id?: string } | Promise<{ id?: string }>): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const id = p.id?.trim();
  return id && id !== 'undefined' ? id : null;
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return NextResponse.json({ error: 'ID de inspección inválido.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as RejectBody;
    const motivo = String(body.motivo ?? '').trim();
    if (motivo.length < 5) {
      return NextResponse.json(
        { error: 'Indique el motivo del rechazo (mínimo 5 caracteres).' },
        { status: 400 },
      );
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { data: inspRaw } = await admin.client
      .from('quality_inspections')
      .select('id, status, invoice_id')
      .eq('id', id)
      .maybeSingle();
    const insp = inspRaw as { id: string; status: string; invoice_id: string } | null;

    if (!insp) {
      return NextResponse.json({ error: 'Inspección no encontrada.' }, { status: 404 });
    }
    if (insp.status !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Esta inspección ya fue procesada.' }, { status: 400 });
    }

    const { error } = await admin.client
      .from('quality_inspections')
      .update({
        status: 'RECHAZADO',
        inspected_at: new Date().toISOString(),
        remarks: motivo.slice(0, 2000),
      } as never)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await finalizarLiberacionCuarentena(admin.client, insp.invoice_id, {
      sincronizarInventario: false,
    });

    return NextResponse.json({ success: true, ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al rechazar inspección';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
