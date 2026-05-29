import { NextResponse } from 'next/server';
import {
  mensajeLineasSinMaterialSku,
  resolverMaterialIdLineasCompra,
} from '@/lib/almacen/resolverMaterialIdPorSku';
import { registrarCompraInventario } from '@/lib/almacen/registrarCompraInventario';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type PendienteIngresoRow = {
  id: string;
  purchase_invoice_id: string | null;
  ubicacion_destino_id: string | null;
};

type CompraContableRow = {
  id: string;
  invoice_number: string | null;
  supplier_rif: string | null;
  supplier_name: string | null;
  fecha: string | null;
  total_amount: number | null;
  ubicacion_destino_id: string | null;
};

type CompraFacturaExistente = { id: string };

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
    const supabase = admin.client;

    const { data: pendienteRaw, error: pErr } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('id,purchase_invoice_id,ubicacion_destino_id')
      .eq('id', id)
      .maybeSingle();
    const pendiente = pendienteRaw as PendienteIngresoRow | null;
    if (pErr || !pendiente?.purchase_invoice_id) {
      return NextResponse.json(
        { error: 'La compra aún no está confirmada en contabilidad.' },
        { status: 400 },
      );
    }

    const purchaseInvoiceId = String(pendiente.purchase_invoice_id);
    const ubicacionDestinoId = String(pendiente.ubicacion_destino_id ?? '').trim();

    const { data: existenteRaw } = await supabase
      .from('compras_facturas')
      .select('id')
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();
    const existente = existenteRaw as CompraFacturaExistente | null;
    if (existente?.id) {
      return NextResponse.json({
        success: true,
        yaExistia: true,
        compraFacturaId: String(existente.id),
      });
    }

    const { data: compraRaw, error: cErr } = await supabase
      .from('contabilidad_compras')
      .select(
        'id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,ubicacion_destino_id',
      )
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();
    const compra = compraRaw as CompraContableRow | null;
    if (cErr || !compra) {
      return NextResponse.json(
        { error: 'No se encontró la compra en contabilidad para este documento.' },
        { status: 400 },
      );
    }

    const resuelto = await resolverMaterialIdLineasCompra(supabase, String(compra.id));
    const lineasInventario = resuelto.lineas;

    if (!lineasInventario.length) {
      const detalle = mensajeLineasSinMaterialSku(resuelto.sinMatch);
      return NextResponse.json(
        {
          error: detalle
            ? `${detalle} Edite la factura y asigne item_code (SKU) del catálogo.`
            : 'La compra no tiene materiales vinculados para inventario.',
          sinMatch: resuelto.sinMatch,
        },
        { status: 400 },
      );
    }

    const destino = String(compra.ubicacion_destino_id ?? ubicacionDestinoId).trim();
    if (!destino) {
      return NextResponse.json(
        { error: 'La compra no tiene almacén de destino.' },
        { status: 400 },
      );
    }

    const result = await registrarCompraInventario(supabase, {
      ubicacionDestinoId: destino,
      numeroFactura: String(compra.invoice_number ?? 'S/N'),
      proveedorRif: String(compra.supplier_rif ?? 'S/R'),
      proveedorNombre: String(compra.supplier_name ?? 'Proveedor'),
      fechaEmision: String(compra.fecha ?? new Date().toISOString().slice(0, 10)),
      total: Number(compra.total_amount ?? 0),
      purchaseInvoiceId,
      lineas: lineasInventario,
    });

    return NextResponse.json({
      success: true,
      yaExistia: false,
      compraFacturaId: result.compraFacturaId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al registrar ingreso';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

