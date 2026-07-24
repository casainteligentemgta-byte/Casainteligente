import { NextResponse } from 'next/server';
import { deleteCompraLineaRegistro } from '@/lib/contabilidad/deleteCompraLineaRegistro';
import { updateCompraLineaRegistro } from '@/lib/contabilidad/updateCompraLineaRegistro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string; lineaId: string } | Promise<{ id: string; lineaId: string }> };

async function resolveParams(
  params: { id: string; lineaId: string } | Promise<{ id: string; lineaId: string }>,
) {
  return params instanceof Promise ? params : Promise.resolve(params);
}

function rechazarCanal(compraId: string) {
  if (!compraId.startsWith('canal-')) return null;
  return NextResponse.json(
    { error: 'Esta compra aún no está en contabilidad. Confírmela o edite la factura pendiente.' },
    { status: 400 },
  );
}

/** PATCH — modifica descripción, código, cantidad y precio unitario de una línea. */
export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id, lineaId } = await resolveParams(ctx.params);
    const canalErr = rechazarCanal(id);
    if (canalErr) return canalErr;

    const body = (await req.json()) as {
      descripcion?: string;
      item_code?: string | null;
      cantidad?: number;
      precio_unitario?: number;
    };

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await updateCompraLineaRegistro(admin.client, id, lineaId, {
      descripcion: String(body.descripcion ?? ''),
      item_code: body.item_code ?? null,
      cantidad: Number(body.cantidad),
      precio_unitario: Number(body.precio_unitario),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo modificar la línea.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE — elimina una línea de contabilidad_compra_lineas (no la factura completa salvo que sea la única línea). */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const { id, lineaId } = await resolveParams(ctx.params);
    const canalErr = rechazarCanal(id);
    if (canalErr) return canalErr;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await deleteCompraLineaRegistro(admin.client, id, lineaId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar la línea.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
