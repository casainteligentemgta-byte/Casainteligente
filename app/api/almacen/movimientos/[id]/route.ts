import { NextResponse } from 'next/server';
import { eliminarMovimientoInventario, parseMovimientoInventarioId } from '@/lib/almacen/eliminarMovimientoInventario';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string | string[] } | Promise<{ id: string | string[] }> };

async function resolveId(params: { id?: string | string[] } | Promise<{ id?: string | string[] }>): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const raw = p.id;
  const joined = Array.isArray(raw) ? raw.join('-') : raw?.trim() ?? '';
  const id = decodeURIComponent(joined);
  return id && id !== 'undefined' ? id : null;
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return NextResponse.json({ error: 'ID de movimiento inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    let proyectoId: string | null = null;
    const parsed = parseMovimientoInventarioId(id);
    if (parsed?.kind === 'ingreso_recepcion_campo') {
      const { data } = await admin.client
        .from('ci_recepciones_campo')
        .select('proyecto_id')
        .eq('id', parsed.recepcionId)
        .maybeSingle();
      proyectoId = String((data as { proyecto_id?: string } | null)?.proyecto_id ?? '').trim() || null;
    }

    const acceso = await requireAlgunPermisoWeb(['almacen.ingreso', 'almacen.despacho'], {
      proyectoId,
    });
    if (!acceso.ok) return acceso.response;

    const result = await eliminarMovimientoInventario(admin.client, id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar el movimiento';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
