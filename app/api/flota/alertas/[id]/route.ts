import { NextResponse } from 'next/server';
import { actualizarAlerta, actualizarConfigAlerta, eliminarAlerta } from '@/lib/flota/alertas';
import { requireAccesoFlota } from '@/lib/flota/acceso';
import { esUuid } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(ctx: RouteCtx): Promise<string> {
  const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
  return params.id?.trim() ?? '';
}

export async function GET() {
  return NextResponse.json({ error: 'Use GET /api/flota/alertas' }, { status: 405 });
}

export async function PUT(req: Request, ctx: RouteCtx) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    if (body.recurso === 'config') {
      const config = await actualizarConfigAlerta(auth.supabase, id, body);
      return NextResponse.json({ ok: true, config });
    }
    const alerta = await actualizarAlerta(auth.supabase, id, body);
    return NextResponse.json({ ok: true, alerta });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al actualizar' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  try {
    await eliminarAlerta(auth.supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al eliminar' },
      { status: 500 },
    );
  }
}
