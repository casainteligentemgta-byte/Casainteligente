import type { SupabaseClient } from '@supabase/supabase-js';
import {
  monedaExtractedConfirmada,
  normalizarMonedaExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import type { LineaCompraContabilidadInput } from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import {
  asegurarMaterialesLineasCompra,
  mensajeLineasSinMaterialSku,
} from '@/lib/almacen/resolverMaterialIdPorSku';
import { copiarDocumentoProcurementAInvoice } from '@/lib/almacen/procurementDocumentStorage';

function lineasDesdeExtracted(ex: ExtractedCanalHeader): LineaCompraContabilidadInput[] {
  return (ex.items ?? [])
    .filter((it) => String(it.description ?? '').trim())
    .map((it) => {
      const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const precio = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
      return {
        descripcion: String(it.description ?? '').trim(),
        item_code: String(it.item_code ?? '').trim() || null,
        unidad: String(it.unit ?? 'UND').trim() || 'UND',
        cantidad,
        precio_unitario: precio,
      };
    });
}

/**
 * Inyecta datos fiscales (OCR) en una compra provisional ya creada al ingresar FRM en obra.
 * No mueve stock ni crea cuarentena.
 */
export async function actualizarCompraProvisionalConFacturaCanal(
  supabase: SupabaseClient,
  params: {
    pendingId: string;
    compraId: string;
    purchaseInvoiceId: string;
    proyectoId: string;
    ubicacionDestinoId: string;
    entidadId?: string | null;
    extracted: ExtractedCanalHeader;
    documentStoragePath?: string | null;
    documentFileName?: string | null;
  },
): Promise<{ compraId: string; purchaseInvoiceId: string }> {
  if (!monedaExtractedConfirmada(params.extracted.moneda)) {
    throw new Error('Indique si la factura está en bolívares (Bs) o dólares (USD).');
  }

  const fecha =
    (params.extracted.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const invoiceNumber = String(params.extracted.invoice_number ?? 'S/N').trim().slice(0, 80);
  const supplierName = String(params.extracted.supplier_name ?? 'Proveedor').trim().slice(0, 200);
  const supplierRif = String(params.extracted.supplier_rif ?? 'S/R').trim().slice(0, 32);

  const lineasBase = lineasDesdeExtracted(params.extracted);
  if (!lineasBase.length) {
    throw new Error('La factura fiscal no tiene líneas válidas.');
  }

  const { lineas, sinMatch } = await asegurarMaterialesLineasCompra(supabase, lineasBase, {
    proyectoId: params.proyectoId,
    fecha,
    ubicacionDestinoId: params.ubicacionDestinoId,
  });

  const lineasConMaterial = lineas.filter((l) => l.material_id?.trim());
  if (!lineasConMaterial.length) {
    throw new Error(mensajeLineasSinMaterialSku(sinMatch));
  }

  const totalMonto = lineasConMaterial.reduce(
    (s, l) => s + l.cantidad * (l.precio_unitario ?? 0),
    0,
  );
  const montos = await resolverMontosCompraBimonetario({
    montoTotal: totalMonto,
    moneda: normalizarMonedaExtracted(params.extracted.moneda),
    fecha,
  });

  if (params.documentStoragePath?.trim()) {
    await copiarDocumentoProcurementAInvoice(supabase, {
      purchaseInvoiceId: params.purchaseInvoiceId,
      sourcePath: params.documentStoragePath.trim(),
      fileName: params.documentFileName ?? undefined,
    });
  }

  await supabase
    .from('purchase_invoices')
    .update({
      invoice_number: invoiceNumber,
      supplier_name: supplierName,
      supplier_rif: supplierRif,
      date: fecha,
      status: 'REGISTRADA',
      proyecto_id: params.proyectoId,
      ubicacion_destino_id: params.ubicacionDestinoId,
      ...(params.entidadId ? { entidad_id: params.entidadId } : {}),
      ...payloadCompraBimonetario(montos),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.purchaseInvoiceId);

  await supabase.from('contabilidad_compra_lineas').delete().eq('compra_id', params.compraId);

  const inserts = lineasConMaterial.map((l) => ({
    compra_id: params.compraId,
    material_id: l.material_id,
    descripcion: l.descripcion,
    item_code: l.item_code ?? null,
    unidad: l.unidad || 'UND',
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario ?? 0,
    subtotal: l.cantidad * (l.precio_unitario ?? 0),
  }));
  const { error: insErr } = await supabase.from('contabilidad_compra_lineas').insert(inserts);
  if (insErr) throw new Error(insErr.message);

  const patchCompra: Record<string, unknown> = {
    invoice_number: invoiceNumber,
    supplier_name: supplierName,
    supplier_rif: supplierRif,
    fecha,
    ...payloadCompraBimonetario(montos),
    ubicacion_destino_id: params.ubicacionDestinoId,
    ingresado_almacen_at: new Date().toISOString(),
    origen: 'FRM_CONCILIADO',
    ...(params.entidadId ? { entidad_id: params.entidadId } : {}),
  };
  await supabase.from('contabilidad_compras').update(patchCompra).eq('id', params.compraId);

  const { data: cf } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('purchase_invoice_id', params.purchaseInvoiceId)
    .maybeSingle();

  if (cf?.id) {
    const facturaId = String(cf.id);
    await supabase
      .from('compras_facturas')
      .update({
        numero_factura: invoiceNumber,
        proveedor_rif: supplierRif,
        proveedor_nombre: supplierName,
        fecha_emision: fecha,
        subtotal: montos.montoVes,
        total: montos.montoVes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', facturaId);

    await supabase.from('compras_factura_lineas').delete().eq('factura_id', facturaId);
    await supabase.from('compras_factura_lineas').insert(
      lineasConMaterial.map((l) => ({
        factura_id: facturaId,
        material_id: l.material_id,
        descripcion: l.descripcion.slice(0, 500),
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario ?? 0,
        requiere_serie: false,
      })),
    );
  }

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'confirmado',
      purchase_invoice_id: params.purchaseInvoiceId,
      proyecto_id: params.proyectoId,
      ubicacion_destino_id: params.ubicacionDestinoId,
      ...(params.entidadId ? { entidad_id: params.entidadId } : {}),
      extracted: params.extracted,
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  return { compraId: params.compraId, purchaseInvoiceId: params.purchaseInvoiceId };
}
