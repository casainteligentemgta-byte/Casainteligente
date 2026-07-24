import { NextResponse } from 'next/server';
import {
  fijarStockMaterialUbicacion,
  listarStockMaterial,
} from '@/lib/almacen/fijarStockMaterialUbicacion';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string | string[] } | Promise<{ id: string | string[] }> };

async function resolveMaterialId(
  params: { id?: string | string[] } | Promise<{ id?: string | string[] }>,
): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const raw = p.id;
  const joined = Array.isArray(raw) ? raw.join('-') : raw?.trim() ?? '';
  const id = decodeURIComponent(joined);
  return id && id !== 'undefined' ? id : null;
}

/** GET /api/almacen/inventario/[id]/stock — filas inventario_stock del material. */
export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const materialId = await resolveMaterialId(ctx.params);
    if (!materialId) {
      return NextResponse.json({ error: 'ID de material inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const filas = await listarStockMaterial(admin.client, materialId);
    const total = filas.reduce((s, f) => s + f.cantidad_disponible, 0);

    return NextResponse.json({ ok: true, materialId, filas, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al listar stock';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH body: { ubicacion_id, cantidad } */
export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const materialId = await resolveMaterialId(ctx.params);
    if (!materialId) {
      return NextResponse.json({ error: 'ID de material inválido.' }, { status: 400 });
    }

    const body = (await req.json()) as { ubicacion_id?: string; cantidad?: number; notas?: string };
    const ubicacionId = body.ubicacion_id?.trim() ?? '';
    if (!ubicacionId) {
      return NextResponse.json({ error: 'Falta ubicacion_id.' }, { status: 400 });
    }

    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const result = await fijarStockMaterialUbicacion(admin.client, {
      materialId,
      ubicacionId,
      cantidadNueva: Number(body.cantidad),
      notas: body.notas,
    });

    return NextResponse.json({ ok: true, materialId, ubicacionId, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al ajustar stock';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
