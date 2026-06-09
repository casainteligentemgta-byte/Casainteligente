import { NextResponse } from 'next/server';
import { approveAllQualityInspectionsForInvoice } from '@/lib/almacen/approveQualityInspection';
import {
  mensajeLineasSinMaterialSku,
  resolverMaterialIdLineasCompra,
} from '@/lib/almacen/resolverMaterialIdPorSku';
import { finalizarLiberacionCuarentena } from '@/lib/almacen/finalizarLiberacionCuarentena';
import { registrarCompraInventario } from '@/lib/almacen/registrarCompraInventario';
import { sincronizarContabilidadTrasInventarioCompra } from '@/lib/contabilidad/sincronizarLogisticaCompraContable';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type CompraContableRow = {
  id: string;
  purchase_invoice_id: string | null;
  invoice_number: string | null;
  supplier_rif: string | null;
  supplier_name: string | null;
  fecha: string | null;
  total_amount: number | null;
  ubicacion_destino_id: string | null;
  document_storage_path: string | null;
};

type CompraFacturaExistente = { id: string };

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requirePermisoWeb('almacen.ingreso');
    if (!auth.ok) return auth.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;

    const compraId = String(params.id ?? '').trim();
    if (!compraId) {
      return NextResponse.json({ error: 'ID de compra inválido.' }, { status: 400 });
    }

    const { data: compraRaw, error: cErr } = await supabase
      .from('contabilidad_compras')
      .select(
        'id,purchase_invoice_id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,ubicacion_destino_id,document_storage_path',
      )
      .eq('id', compraId)
      .maybeSingle();
    const compra = compraRaw as CompraContableRow | null;

    if (cErr || !compra) {
      return NextResponse.json({ error: 'Compra no encontrada.' }, { status: 404 });
    }
    if (!compra.purchase_invoice_id) {
      return NextResponse.json(
        { error: 'Esta compra no tiene documento base para ingreso a almacén.' },
        { status: 400 },
      );
    }
    if (!compra.ubicacion_destino_id) {
      return NextResponse.json(
        { error: 'La compra no tiene almacén destino asignado.' },
        { status: 400 },
      );
    }

    const purchaseInvoiceId = String(compra.purchase_invoice_id);

    const { data: existenteRaw } = await supabase
      .from('compras_facturas')
      .select('id')
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();
    const existente = existenteRaw as CompraFacturaExistente | null;
    if (existente?.id) {
      await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);
      return NextResponse.json({
        success: true,
        yaExistia: true,
        compraFacturaId: String(existente.id),
        estadoLogistica: 'en_almacen',
      });
    }

    const { count: pendientesCount } = await supabase
      .from('quality_inspections')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', purchaseInvoiceId)
      .eq('status', 'PENDIENTE');

    if ((pendientesCount ?? 0) > 0) {
      const { aprobadas } = await approveAllQualityInspectionsForInvoice(
        supabase,
        purchaseInvoiceId,
        null,
      );

      const { data: cfRaw } = await supabase
        .from('compras_facturas')
        .select('id')
        .eq('purchase_invoice_id', purchaseInvoiceId)
        .maybeSingle();
      const cf = cfRaw as CompraFacturaExistente | null;

      await finalizarLiberacionCuarentena(supabase, purchaseInvoiceId);

      return NextResponse.json({
        success: true,
        yaExistia: false,
        viaCuarentena: true,
        aprobadas,
        compraFacturaId: cf?.id ? String(cf.id) : undefined,
        estadoLogistica: 'en_almacen',
      });
    }

    const resuelto = await resolverMaterialIdLineasCompra(supabase, compraId, {
      ubicacionDestinoId: compra.ubicacion_destino_id,
      purchaseInvoiceId,
    });
    const lineasInventario = resuelto.lineas;
    const avisos: string[] = [];
    if (resuelto.materialesCreados > 0) {
      avisos.push(
        `Se crearon ${resuelto.materialesCreados} material(es) nuevo(s) en el catálogo.`,
      );
    }
    const detalleSinMatch = mensajeLineasSinMaterialSku(resuelto.sinMatch);
    if (detalleSinMatch) avisos.push(detalleSinMatch);

    if (!lineasInventario.length) {
      return NextResponse.json(
        {
          error: detalleSinMatch
            ? `${detalleSinMatch} Revise las líneas en la compra.`
            : 'La compra no tiene líneas con cantidad para inventario.',
          sinMatch: resuelto.sinMatch,
          vinculadas: resuelto.vinculadas,
          total: resuelto.total,
        },
        { status: 400 },
      );
    }

    const r = await registrarCompraInventario(supabase, {
      ubicacionDestinoId: String(compra.ubicacion_destino_id),
      numeroFactura: String(compra.invoice_number ?? 'S/N'),
      proveedorRif: String(compra.supplier_rif ?? 'S/R'),
      proveedorNombre: String(compra.supplier_name ?? 'Proveedor'),
      fechaEmision: String(compra.fecha ?? new Date().toISOString().slice(0, 10)),
      total: Number(compra.total_amount ?? 0),
      purchaseInvoiceId,
      documentoStoragePath: compra.document_storage_path,
      lineas: lineasInventario,
    });

    await sincronizarContabilidadTrasInventarioCompra(supabase, purchaseInvoiceId);

    return NextResponse.json({
      success: true,
      yaExistia: false,
      viaCuarentena: false,
      compraFacturaId: r.compraFacturaId,
      avisos: avisos.length ? avisos : undefined,
      materialesCreados: resuelto.materialesCreados || undefined,
      estadoLogistica: 'en_almacen',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al ingresar compra en almacén';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
