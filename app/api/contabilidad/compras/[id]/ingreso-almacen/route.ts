import { NextResponse } from 'next/server';
import { registrarCompraInventario } from '@/lib/almacen/registrarCompraInventario';
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

type LineaContableRow = {
  material_id: string | null;
  descripcion: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
};

type CompraFacturaExistente = { id: string };

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
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
      return NextResponse.json({
        success: true,
        yaExistia: true,
        compraFacturaId: String(existente.id),
      });
    }

    const { data: lineasRaw, error: lErr } = await supabase
      .from('contabilidad_compra_lineas')
      .select('material_id,descripcion,cantidad,precio_unitario')
      .eq('compra_id', compraId);
    const lineas = (lineasRaw ?? []) as LineaContableRow[];
    if (lErr) {
      return NextResponse.json(
        { error: `No se pudieron leer líneas de la compra: ${lErr.message}` },
        { status: 400 },
      );
    }

    const lineasInventario = lineas
      .filter((l) => String(l.material_id ?? '').trim())
      .map((l) => ({
        material_id: String(l.material_id),
        descripcion: String(l.descripcion ?? '').trim() || 'Ítem',
        cantidad: Number(l.cantidad ?? 0),
        precio_unitario: Number(l.precio_unitario ?? 0),
      }))
      .filter((l) => l.cantidad > 0);

    if (!lineasInventario.length) {
      return NextResponse.json(
        {
          error:
            'La compra no tiene materiales vinculados para inventario. Asigne material_id en líneas de contabilidad.',
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

    return NextResponse.json({
      success: true,
      yaExistia: false,
      compraFacturaId: r.compraFacturaId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al ingresar compra en almacén';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

