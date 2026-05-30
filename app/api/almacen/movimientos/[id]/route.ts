import { NextResponse } from 'next/server';
import { eliminarMovimientoInventario } from '@/lib/almacen/eliminarMovimientoInventario';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(params: { id?: string } | Promise<{ id?: string }>): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const id = decodeURIComponent(p.id?.trim() ?? '');
  return id && id !== 'undefined' ? id : null;
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return NextResponse.json({ error: 'ID de movimiento inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await eliminarMovimientoInventario(admin.client, id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar el movimiento';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
