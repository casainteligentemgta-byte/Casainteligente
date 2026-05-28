import { NextResponse } from 'next/server';
import { reubicarCompraObra } from '@/lib/almacen/reubicarCompraObra';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id?: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await resolveParams(ctx.params);
    if (!id?.trim() || id === 'undefined') {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = (await req.json()) as {
      proyecto_id?: string;
      ubicacion_destino_id?: string;
      nombre_obra?: string;
    };

    const proyectoId = String(body.proyecto_id ?? '').trim();
    const ubicacionDestinoId = String(body.ubicacion_destino_id ?? '').trim();

    if (!proyectoId || !ubicacionDestinoId) {
      return NextResponse.json(
        { error: 'proyecto_id y ubicacion_destino_id son obligatorios.' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

    const referenciaId = id.startsWith('canal-') ? id.slice('canal-'.length) : id;
    const referenciaTipo = id.startsWith('canal-') ? undefined : 'compra';

    let result;

    if (id.startsWith('canal-')) {
      const { data: pendiente, error: pErr } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('id, purchase_invoice_id')
        .eq('id', referenciaId)
        .single();
      if (pErr || !pendiente) {
        return NextResponse.json({ error: 'Factura de canal no encontrada' }, { status: 404 });
      }

      await supabase
        .from('ci_facturas_canal_pendientes')
        .update({
          proyecto_id: proyectoId,
          ubicacion_destino_id: ubicacionDestinoId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', referenciaId);

      if (pendiente.purchase_invoice_id) {
        result = await reubicarCompraObra(supabase, {
          referenciaId: String(pendiente.purchase_invoice_id),
          referenciaTipo: 'purchase_invoice',
          proyectoId,
          ubicacionDestinoId,
          nombreObra: body.nombre_obra,
        });
      } else {
        result = {
          purchaseInvoiceId: null,
          compraId: null,
          stockMovido: false,
          ubicacionAnteriorId: null,
        };
      }
    } else {
      result = await reubicarCompraObra(supabase, {
        referenciaId: id,
        referenciaTipo: 'compra',
        proyectoId,
        ubicacionDestinoId,
        nombreObra: body.nombre_obra,
      });
    }

    return NextResponse.json({
      ok: true,
      purchaseInvoiceId: result.purchaseInvoiceId,
      compraId: result.compraId,
      stockMovido: result.stockMovido,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al reubicar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
