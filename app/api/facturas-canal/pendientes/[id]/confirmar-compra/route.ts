import { NextResponse } from 'next/server';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { confirmarCompraDesdeCanal } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
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

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const id = idFromParams(await resolveParams(ctx.params));
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }

    const body = (await req.json()) as {
      proyecto_id?: string;
      ubicacion_destino_id?: string;
      extracted?: ExtractedCanalHeader;
    };

    const proyectoId = String(body.proyecto_id ?? '').trim();
    if (!proyectoId) {
      return NextResponse.json({ error: 'Seleccione un proyecto.' }, { status: 400 });
    }

    const ubicacionDestinoId = String(body.ubicacion_destino_id ?? '').trim();
    if (!ubicacionDestinoId) {
      return NextResponse.json({ error: 'Seleccione el almacén de ingreso.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await confirmarCompraDesdeCanal(admin.client, {
      pendingId: id,
      proyectoId,
      ubicacionDestinoId,
      extractedOverride: body.extracted,
    });

    return NextResponse.json({
      success: true,
      compraId: result.compraId,
      purchaseInvoiceId: result.purchaseInvoiceId,
      yaExistia: result.yaExistia,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar compra';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
