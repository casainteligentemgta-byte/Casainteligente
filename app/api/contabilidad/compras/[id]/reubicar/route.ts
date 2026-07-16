import { NextResponse } from 'next/server';
import { reubicarCompraObra } from '@/lib/almacen/reubicarCompraObra';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id?: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

/** Reasigna obra/almacén de una compra y traslada stock si ya estaba registrada en inventario. */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const { id } = await resolveParams(ctx.params);
    if (!id?.trim() || id === 'undefined') {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = (await req.json()) as {
      entidad_id?: string;
      proyecto_id?: string;
      ubicacion_destino_id?: string;
      nombre_obra?: string;
    };

    const proyectoId = String(body.proyecto_id ?? '').trim();
    const ubicacionDestinoId = String(body.ubicacion_destino_id ?? '').trim();
    let entidadId = String(body.entidad_id ?? '').trim() || null;

    if (!proyectoId) {
      return NextResponse.json({ error: 'Seleccione la obra o proyecto.' }, { status: 400 });
    }

    const supabase = admin.client;

    if (!entidadId) {
      entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);
    }

    if (id.startsWith('canal-')) {
      const referenciaId = id.slice('canal-'.length);
      const { data: pendiente, error: pErr } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('id, purchase_invoice_id, entidad_id, proyecto_id, ubicacion_destino_id, extracted')
        .eq('id', referenciaId)
        .single();

      if (pErr || !pendiente) {
        return NextResponse.json({ error: 'Factura de canal no encontrada' }, { status: 404 });
      }

      const pend = pendiente as {
        id: string;
        purchase_invoice_id: string | null;
        entidad_id: string | null;
        proyecto_id: string | null;
        ubicacion_destino_id: string | null;
        extracted: Record<string, unknown> | null;
      };
      const ubiPend = String(pend.ubicacion_destino_id ?? '');
      if (
        String(pend.entidad_id ?? '') === (entidadId ?? '') &&
        String(pend.proyecto_id ?? '') === proyectoId &&
        ubiPend === ubicacionDestinoId
      ) {
        return NextResponse.json({
          success: true,
          ok: true,
          sinCambios: true,
          message: 'La compra ya se encuentra en la ubicación seleccionada.',
        });
      }

      const prevExtracted = pend.extracted ?? {};
      const patchCanal: Record<string, unknown> = {
        proyecto_id: proyectoId,
        ubicacion_destino_id: ubicacionDestinoId || null,
        extracted: {
          ...prevExtracted,
          reubicacion: {
            reubicado_automaticamente: true,
            fecha_reubicacion: new Date().toISOString(),
            entidad_id: entidadId,
            proyecto_id: proyectoId,
            ubicacion_destino_id: ubicacionDestinoId || null,
          },
        },
        updated_at: new Date().toISOString(),
      };
      if (entidadId) patchCanal.entidad_id = entidadId;
      await supabase
        .from('ci_facturas_canal_pendientes')
        .update(patchCanal as never)
        .eq('id', referenciaId);

      if (pend.purchase_invoice_id) {
        const result = await reubicarCompraObra(supabase, {
          referenciaId: String(pend.purchase_invoice_id),
          referenciaTipo: 'purchase_invoice',
          entidadId,
          proyectoId,
          ubicacionDestinoId,
          nombreObra: body.nombre_obra,
        });

        return NextResponse.json({
          success: true,
          ok: true,
          sinCambios: result.sinCambios ?? false,
          message: result.message,
          purchaseInvoiceId: result.purchaseInvoiceId,
          compraId: result.compraId,
          stockMovido: result.stockMovido,
        });
      }

      return NextResponse.json({
        success: true,
        ok: true,
        message: 'Obra y almacén actualizados en la cola del canal.',
        stockMovido: false,
      });
    }

    const result = await reubicarCompraObra(supabase, {
      referenciaId: id,
      referenciaTipo: 'compra',
      entidadId,
      proyectoId,
      ubicacionDestinoId,
      nombreObra: body.nombre_obra,
    });

    return NextResponse.json({
      success: true,
      ok: true,
      sinCambios: result.sinCambios ?? false,
      message: result.message,
      purchaseInvoiceId: result.purchaseInvoiceId,
      compraId: result.compraId,
      stockMovido: result.stockMovido,
    });
  } catch (err: unknown) {
    console.error('[CRITICAL REUBICAR COMPRA ERROR]:', err);
    return NextResponse.json(
      { error: formatErrorMessage(err) || 'Error interno al procesar la reubicación de la compra.' },
      { status: 500 },
    );
  }
}
