import { NextResponse } from 'next/server';
import {
  actualizarMantenimiento,
  eliminarMantenimiento,
  obtenerMantenimiento,
} from '@/lib/flota/mantenimiento';
import { requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';
import { esUuid } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(ctx: RouteCtx): Promise<string> {
  const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
  return params.id?.trim() ?? '';
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  try {
    const { item, migracionPendiente } = await obtenerMantenimiento(auth.supabase, id);
    if (migracionPendiente) return respuestaMigracionPendiente({ registro: null });
    if (!item) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, registro: item });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cargar' },
      { status: 500 },
    );
  }
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
    const registro = await actualizarMantenimiento(auth.supabase, id, body);
    return NextResponse.json({ ok: true, registro });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: /requerido|inválid/i.test(msg) ? 400 : 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;
  const id = await resolveId(ctx);
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  try {
    await eliminarMantenimiento(auth.supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al eliminar' },
      { status: 500 },
    );
  }
}
