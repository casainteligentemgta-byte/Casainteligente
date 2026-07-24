import { NextResponse } from 'next/server';
import {
  contarVinculosMaterialInventario,
  eliminarMaterialInventarioCascada,
  totalVinculosMaterial,
} from '@/lib/almacen/eliminarMaterialInventario';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string | string[] } | Promise<{ id: string | string[] }> };

async function resolveId(
  params: { id?: string | string[] } | Promise<{ id?: string | string[] }>,
): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const raw = p.id;
  const joined = Array.isArray(raw) ? raw.join('-') : raw?.trim() ?? '';
  const id = decodeURIComponent(joined);
  return id && id !== 'undefined' ? id : null;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return NextResponse.json({ error: 'ID de material inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const vinculos = await contarVinculosMaterialInventario(admin.client, id);
    return NextResponse.json({
      materialId: id,
      vinculos,
      total: totalVinculosMaterial(vinculos),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo consultar vínculos';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return NextResponse.json({ error: 'ID de material inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const result = await eliminarMaterialInventarioCascada(admin.client, id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar el material';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
