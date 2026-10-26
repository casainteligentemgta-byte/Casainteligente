import { NextResponse } from 'next/server';
import { deleteCompraRegistro } from '@/lib/contabilidad/deleteCompraRegistro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { MENSAJE_FACTURA_DUPLICADA, esErrorFacturaDuplicada } from '@/lib/canal/facturaDuplicada';
import {
  cambiosEntreFacturas,
  registrarCambiosFactura,
  type CambioFactura,
} from '@/lib/contabilidad/historialCambiosFactura';
export const dynamic = 'force-dynamic';

function idFromParams(params: { id?: string }): string | null {
  const id = params.id?.trim();
  return id && id !== 'undefined' ? id : null;
}

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id?: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar', 'cco.ver']);
  if (!acceso.ok) return acceso.response;

  try {
    const id = idFromParams(await resolveParams(ctx.params));
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;
    const { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No encontrado';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar']);
  if (!acceso.ok) return acceso.response;

  try {
    const id = idFromParams(params);
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }
    const body = (await req.json()) as {
      estado?: string;
      proyecto_id?: string;
      ubicacion_destino_id?: string;
      purchase_invoice_id?: string;
      extracted?: Record<string, unknown>;
      mensaje_error?: string | null;
    };
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.estado) update.estado = body.estado;
    if (body.proyecto_id !== undefined) update.proyecto_id = body.proyecto_id;
    if (body.ubicacion_destino_id !== undefined) {
      update.ubicacion_destino_id = body.ubicacion_destino_id;
    }
    if (body.purchase_invoice_id !== undefined) update.purchase_invoice_id = body.purchase_invoice_id;
    // Historial: qué campos cambian respecto a la versión guardada.
    let cambiosExtracted: CambioFactura[] = [];
    if (body.extracted !== undefined) {
      const { data: actual } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('extracted')
        .eq('id', id)
        .maybeSingle();
      cambiosExtracted = cambiosEntreFacturas(
        (actual?.extracted ?? {}) as Record<string, unknown>,
        body.extracted,
      );
      update.extracted = body.extracted;
    }
    if (body.mensaje_error !== undefined) update.mensaje_error = body.mensaje_error;

    const { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      // Tabla sin tipos generados en Supabase client
      .update(update as never)
      .eq('id', id)
      .select(
        'id, canal, chat_id, chat_label, estado, proyecto_id, ubicacion_destino_id, purchase_invoice_id, document_file_name, document_storage_path, extracted, mensaje_error, created_at',
      )
      .single();
    if (esErrorFacturaDuplicada(error)) {
      return NextResponse.json(
        { error: MENSAJE_FACTURA_DUPLICADA, codigo: 'factura_duplicada' },
        { status: 409 },
      );
    }
    if (error) throw error;
    await registrarCambiosFactura(supabase, {
      tabla: 'ci_facturas_canal_pendientes',
      registroId: id,
      cambios: cambiosExtracted,
      origen: 'web',
      actor: acceso.userId,
    });
    return NextResponse.json({ success: true, pendiente: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar']);
  if (!acceso.ok) return acceso.response;

  try {
    const id = idFromParams(await resolveParams(ctx.params));
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;
    const completo = new URL(req.url).searchParams.get('completo') === '1';

    let deletedCompraIds: string[] = [];
    let materialPermaneceEnStock = false;

    if (completo) {
      const { data: canal, error: canalErr } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('id, purchase_invoice_id')
        .eq('id', id)
        .maybeSingle();
      if (canalErr) throw canalErr;

      const canalRow = canal as { id: string; purchase_invoice_id: string | null } | null;
      if (canalRow?.purchase_invoice_id) {
        const { data: compras, error: comprasErr } = await supabase
          .from('contabilidad_compras')
          .select('id')
          .eq('purchase_invoice_id', canalRow.purchase_invoice_id);
        if (comprasErr) throw comprasErr;

        for (const row of (compras ?? []) as { id: string }[]) {
          const r = await deleteCompraRegistro(supabase, row.id);
          deletedCompraIds.push(...r.deletedIds);
          if (r.materialPermaneceEnStock) materialPermaneceEnStock = true;
        }
      }
    }

    const { error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .delete()
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      deletedCompraIds,
      materialPermaneceEnStock: materialPermaneceEnStock || undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
