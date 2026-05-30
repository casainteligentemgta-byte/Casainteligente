import { NextResponse } from 'next/server';
import { ingresoAlmacenDesdePendienteCanal } from '@/lib/contabilidad/ingresoAlmacenDesdePendienteCanal';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id?: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

function idFromParams(params: { id?: string }): string | null {
  const id = params.id?.trim();
  return id && id !== 'undefined' ? id : null;
}

export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const id = idFromParams(await resolveParams(ctx.params));
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const ingreso = await ingresoAlmacenDesdePendienteCanal(admin.client, id);
    if (!ingreso.success) {
      return NextResponse.json({ error: ingreso.error ?? 'Error al registrar ingreso' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      yaExistia: ingreso.yaExistia ?? false,
      compraFacturaId: ingreso.compraFacturaId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al registrar ingreso';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
