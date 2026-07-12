import type { SupabaseClient } from '@supabase/supabase-js';
import { finalizarLiberacionCuarentena } from '@/lib/almacen/finalizarLiberacionCuarentena';
import { aplicarLiberacionTransitoADisponible } from '@/lib/almacen/stockTransitoCompra';
import { materialEsGastoInmediato } from '@/lib/almacen/esGastoInmediatoCompra';
import {
  registrarCompraInventario,
  type LineaCompraInventarioInput,
} from '@/lib/almacen/registrarCompraInventario';

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

async function aplicarDeltaStock(
  supabase: SupabaseClient,
  ubicacionDestinoId: string,
  materialId: string,
  cantidad: number,
  meta?: {
    invoiceId?: string;
    referenciaId?: string;
    referenciaTipo?: string;
  },
): Promise<void> {
  await aplicarLiberacionTransitoADisponible(supabase, {
    ubicacionDestinoId,
    materialId,
    cantidad,
    purchaseInvoiceId: meta?.invoiceId ?? null,
    referenciaId: meta?.referenciaId ?? null,
    referenciaTipo: meta?.referenciaTipo ?? 'quality_inspection',
  });
}

async function registrarLineaEnCompraFactura(
  supabase: SupabaseClient,
  params: {
    compraFacturaId: string;
    materialId: string;
    descripcion: string;
    quantity: number;
    unitPrice: number;
    ubicacionDestinoId: string;
  },
): Promise<void> {
  const { error: lineErr } = await supabase.from('compras_factura_lineas').insert({
    factura_id: params.compraFacturaId,
    material_id: params.materialId,
    descripcion: params.descripcion.trim().slice(0, 500) || 'Ítem',
    cantidad: params.quantity,
    precio_unitario: params.unitPrice,
  });
  if (lineErr) throw lineErr;

  const gastoInmediato = await materialEsGastoInmediato(supabase, params.materialId);
  if (!gastoInmediato) {
    await aplicarDeltaStock(
      supabase,
      params.ubicacionDestinoId,
      params.materialId,
      params.quantity,
    );
  }
}

type InspeccionPendiente = {
  id: string;
  material_id: string;
  quantity: number;
  invoice_id: string;
  purchase_detail_id: string | null;
  status: string;
};

async function resolverPrecioYDescripcion(
  supabase: SupabaseClient,
  inspection: InspeccionPendiente,
): Promise<{ unitPrice: number; descripcion: string }> {
  let unitPrice = 0;
  let descripcion = 'Aprobación calidad';
  if (inspection.purchase_detail_id) {
    const { data: detail } = await supabase
      .from('purchase_details')
      .select('unit_price, description')
      .eq('id', inspection.purchase_detail_id)
      .maybeSingle();
    unitPrice = Number(detail?.unit_price) || 0;
    descripcion = String(detail?.description ?? descripcion).trim() || descripcion;
  }
  return { unitPrice, descripcion };
}

async function insertarMovimiento101(
  supabase: SupabaseClient,
  params: {
    materialId: string;
    quantity: number;
    unitPrice: number;
    invoiceId: string;
    inspectorId?: string | null;
  },
): Promise<void> {
  const { error: movErr } = await supabase.from('inventory_movements').insert({
    material_id: params.materialId,
    movement_type_code: '101',
    quantity: params.quantity,
    previous_stock: 0,
    new_stock: params.quantity,
    previous_cost: 0,
    new_cost: params.unitPrice,
    reference_id: params.invoiceId,
    user_id: params.inspectorId ?? null,
  });
  if (movErr && movErr.code !== '42P01') {
    console.warn('[approveQualityInspection] inventory_movements:', movErr.message);
  }
}

async function marcarInspeccionAprobada(
  supabase: SupabaseClient,
  inspectionId: string,
  inspectorId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('quality_inspections')
    .update({
      status: 'APROBADO',
      inspector_id: inspectorId ?? null,
      inspected_at: new Date().toISOString(),
    })
    .eq('id', inspectionId);
  if (error) throw error;
}

async function ingresarLineasAlInventario(
  supabase: SupabaseClient,
  params: {
    invoiceId: string;
    ubicacionDestinoId: string;
    invoiceMeta: {
      invoice_number: string | null;
      supplier_rif: string | null;
      supplier_name: string | null;
      date: string | null;
      total_amount: number | null;
    };
    lineas: LineaCompraInventarioInput[];
  },
): Promise<{ compraFacturaId: string }> {
  const { data: existente } = await supabase
    .from('compras_facturas')
    .select('id, estado')
    .eq('purchase_invoice_id', params.invoiceId)
    .maybeSingle();

  if (existente?.estado === 'registrada') {
    for (const l of params.lineas) {
      await registrarLineaEnCompraFactura(supabase, {
        compraFacturaId: String(existente.id),
        materialId: l.material_id,
        descripcion: l.descripcion,
        quantity: l.cantidad,
        unitPrice: l.precio_unitario,
        ubicacionDestinoId: params.ubicacionDestinoId,
      });
    }
    return { compraFacturaId: String(existente.id) };
  }

  const r = await registrarCompraInventario(supabase, {
    ubicacionDestinoId: params.ubicacionDestinoId,
    numeroFactura: String(params.invoiceMeta.invoice_number ?? 'S/N'),
    proveedorRif: params.invoiceMeta.supplier_rif,
    proveedorNombre: String(params.invoiceMeta.supplier_name ?? 'Proveedor'),
    fechaEmision: String(params.invoiceMeta.date ?? new Date().toISOString().slice(0, 10)),
    total: Number(params.invoiceMeta.total_amount ?? 0),
    purchaseInvoiceId: params.invoiceId,
    lineas: params.lineas,
  });
  return { compraFacturaId: r.compraFacturaId };
}

/**
 * Aprueba inspección: stock en inventario_stock (ubicación obra), no en global_inventory.
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

  const { unitPrice, descripcion } = await resolverPrecioYDescripcion(
    supabase,
    inspection as InspeccionPendiente,
  );

  const { data: invoice, error: invErr } = await supabase
    .from('purchase_invoices')
    .select('id, ubicacion_destino_id, invoice_number, supplier_rif, supplier_name, date, total_amount')
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

  await actualizarCostoMaestroSku(supabase, inspection.material_id, qty, unitPrice);

  await ingresarLineasAlInventario(supabase, {
    invoiceId: inspection.invoice_id,
    ubicacionDestinoId,
    invoiceMeta: {
      invoice_number: invoice?.invoice_number ?? null,
      supplier_rif: invoice?.supplier_rif ?? null,
      supplier_name: invoice?.supplier_name ?? null,
      date: invoice?.date ?? null,
      total_amount: invoice?.total_amount ?? null,
    },
    lineas: [
      {
        material_id: inspection.material_id,
        descripcion,
        cantidad: qty,
        precio_unitario: unitPrice,
      },
    ],
  });

  await insertarMovimiento101(supabase, {
    materialId: inspection.material_id,
    quantity: qty,
    unitPrice,
    invoiceId: inspection.invoice_id,
    inspectorId,
  });

  await marcarInspeccionAprobada(supabase, inspectionId, inspectorId);

  await finalizarLiberacionCuarentena(supabase, inspection.invoice_id);
}

/** Aprueba todas las líneas PENDIENTE de una factura e ingresa stock en un solo paso. */
export async function approveAllQualityInspectionsForInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  inspectorId?: string | null,
): Promise<{ aprobadas: number }> {
  const { data: inspections, error } = await supabase
    .from('quality_inspections')
    .select('id, material_id, quantity, invoice_id, purchase_detail_id, status')
    .eq('invoice_id', invoiceId)
    .eq('status', 'PENDIENTE');

  if (error) throw new Error(error.message);
  if (!inspections?.length) {
    throw new Error('No hay líneas pendientes en cuarentena para esta factura.');
  }

  const { data: invoice, error: invErr } = await supabase
    .from('purchase_invoices')
    .select(
      'id, ubicacion_destino_id, invoice_number, supplier_rif, supplier_name, date, total_amount',
    )
    .eq('id', invoiceId)
    .maybeSingle();

  if (invErr) throw new Error(invErr.message);
  const ubicacionDestinoId = invoice?.ubicacion_destino_id?.trim();
  if (!ubicacionDestinoId) {
    throw new Error('La factura no tiene almacén destino asignado.');
  }

  const lineasInventario: LineaCompraInventarioInput[] = [];

  for (const raw of inspections) {
    const inspection = raw as InspeccionPendiente;
    const qty = Number(inspection.quantity) || 0;
    if (qty <= 0) continue;

    const { unitPrice, descripcion } = await resolverPrecioYDescripcion(supabase, inspection);
    await actualizarCostoMaestroSku(supabase, inspection.material_id, qty, unitPrice);

    lineasInventario.push({
      material_id: inspection.material_id,
      descripcion,
      cantidad: qty,
      precio_unitario: unitPrice,
    });
  }

  if (!lineasInventario.length) {
    throw new Error('No hay cantidades válidas para liberar.');
  }

  await ingresarLineasAlInventario(supabase, {
    invoiceId,
    ubicacionDestinoId,
    invoiceMeta: {
      invoice_number: invoice?.invoice_number ?? null,
      supplier_rif: invoice?.supplier_rif ?? null,
      supplier_name: invoice?.supplier_name ?? null,
      date: invoice?.date ?? null,
      total_amount: invoice?.total_amount ?? null,
    },
    lineas: lineasInventario,
  });

  for (const raw of inspections) {
    const inspection = raw as InspeccionPendiente;
    const qty = Number(inspection.quantity) || 0;
    if (qty <= 0) continue;

    const { unitPrice } = await resolverPrecioYDescripcion(supabase, inspection);

    await insertarMovimiento101(supabase, {
      materialId: inspection.material_id,
      quantity: qty,
      unitPrice,
      invoiceId,
      inspectorId,
    });

    await marcarInspeccionAprobada(supabase, inspection.id, inspectorId);
  }

  await finalizarLiberacionCuarentena(supabase, invoiceId);

  return { aprobadas: inspections.length };
}

export { formatApproveError };
