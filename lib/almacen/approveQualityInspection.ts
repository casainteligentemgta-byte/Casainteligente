import type { SupabaseClient } from '@supabase/supabase-js';
import { registrarCompraInventario } from '@/lib/almacen/registrarCompraInventario';

function formatApproveError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: string }).message);
    const code =
      'code' in error ? String((error as { code?: string }).code ?? '') : '';
    if (code === '42501' || /row-level security/i.test(msg)) {
      return 'Sin permiso en Supabase. Ejecute las migraciones 134 y 136 en el SQL Editor.';
    }
    if (/inventory_movements/i.test(msg) && /does not exist/i.test(msg)) {
      return 'Falta la tabla inventory_movements. Revise el esquema de almacén en Supabase.';
    }
    return msg;
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo aprobar la inspección.';
}

async function actualizarCostoMaestroSku(
  supabase: SupabaseClient,
  materialId: string,
  quantity: number,
  unitPrice: number,
): Promise<void> {
  const { data: item } = await supabase
    .from('global_inventory')
    .select('average_weighted_cost')
    .eq('id', materialId)
    .maybeSingle();

  const prevCost = Number(item?.average_weighted_cost) || 0;
  const price = unitPrice;
  const newCost = price > 0 ? price : prevCost;

  const { error } = await supabase
    .from('global_inventory')
    .update({
      average_weighted_cost: newCost,
      last_purchase_price: price,
      last_purchase_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId);

  if (error) throw error;
}

async function asegurarCompraRegistradaEnUbicacion(
  supabase: SupabaseClient,
  params: {
    inspectionId: string;
    invoiceId: string;
    materialId: string;
    quantity: number;
    unitPrice: number;
    ubicacionDestinoId: string;
  },
): Promise<void> {
  const { data: existente } = await supabase
    .from('compras_facturas')
    .select('id, estado')
    .eq('purchase_invoice_id', params.invoiceId)
    .maybeSingle();

  if (existente?.estado === 'registrada') {
    const { error: rpcErr } = await supabase.rpc('inv_stock_apply_delta', {
      p_ubicacion_id: params.ubicacionDestinoId,
      p_material_id: params.materialId,
      p_delta_disponible: params.quantity,
      p_delta_reservada: 0,
      p_delta_transito_entrante: 0,
    });
    if (rpcErr && rpcErr.code !== '42883') throw rpcErr;
    return;
  }

  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('invoice_number, supplier_rif, supplier_name, date, total_amount')
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (!inv) throw new Error('Factura de compra no encontrada.');

  await registrarCompraInventario(supabase, {
    ubicacionDestinoId: params.ubicacionDestinoId,
    numeroFactura: String(inv.invoice_number ?? 'S/N'),
    proveedorRif: inv.supplier_rif,
    proveedorNombre: String(inv.supplier_name ?? 'Proveedor'),
    fechaEmision: String(inv.date ?? new Date().toISOString().slice(0, 10)),
    total: Number(inv.total_amount ?? 0),
    purchaseInvoiceId: params.invoiceId,
    lineas: [
      {
        material_id: params.materialId,
        descripcion: 'Aprobación calidad',
        cantidad: params.quantity,
        precio_unitario: params.unitPrice,
      },
    ],
  });
}

/**
 * Aprueba inspección: stock solo en inventario_stock (ubicación obra), no en global_inventory.
 */
export async function approveQualityInspection(
  supabase: SupabaseClient,
  inspectionId: string,
  inspectorId?: string | null,
): Promise<void> {
  const { data: inspection, error: fetchError } = await supabase
    .from('quality_inspections')
    .select('id, material_id, quantity, invoice_id, purchase_detail_id, status')
    .eq('id', inspectionId)
    .single();

  if (fetchError || !inspection) {
    throw new Error('Inspección no encontrada.');
  }
  if (inspection.status !== 'PENDIENTE') {
    throw new Error('Esta inspección ya fue procesada.');
  }

  let unitPrice = 0;
  if (inspection.purchase_detail_id) {
    const { data: detail } = await supabase
      .from('purchase_details')
      .select('unit_price, description')
      .eq('id', inspection.purchase_detail_id)
      .maybeSingle();
    unitPrice = Number(detail?.unit_price) || 0;
  }

  const { data: invoice, error: invErr } = await supabase
    .from('purchase_invoices')
    .select('id, ubicacion_destino_id, proyecto_id')
    .eq('id', inspection.invoice_id)
    .maybeSingle();

  if (invErr) throw new Error(invErr.message);
  const ubicacionDestinoId = invoice?.ubicacion_destino_id?.trim();
  if (!ubicacionDestinoId) {
    throw new Error(
      'La factura no tiene ubicación de destino. Recepcione de nuevo con almacén asignado.',
    );
  }

  const qty = Number(inspection.quantity) || 0;
  if (qty <= 0) throw new Error('Cantidad de inspección inválida.');

  const { error: updateInspError } = await supabase
    .from('quality_inspections')
    .update({
      status: 'APROBADO',
      inspector_id: inspectorId ?? null,
      inspected_at: new Date().toISOString(),
    })
    .eq('id', inspectionId);

  if (updateInspError) throw updateInspError;

  await actualizarCostoMaestroSku(supabase, inspection.material_id, qty, unitPrice);

  await asegurarCompraRegistradaEnUbicacion(supabase, {
    inspectionId,
    invoiceId: inspection.invoice_id,
    materialId: inspection.material_id,
    quantity: qty,
    unitPrice,
    ubicacionDestinoId,
  });

  const { error: movErr } = await supabase.from('inventory_movements').insert({
    material_id: inspection.material_id,
    movement_type_code: '101',
    quantity: qty,
    previous_stock: 0,
    new_stock: qty,
    previous_cost: 0,
    new_cost: unitPrice,
    reference_id: inspection.invoice_id,
    user_id: inspectorId ?? null,
  });

  if (movErr && movErr.code !== '42P01') {
    console.warn('[approveQualityInspection] inventory_movements:', movErr.message);
  }
}

export { formatApproveError };
