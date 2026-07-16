import type { SupabaseClient } from '@supabase/supabase-js';

import type { CompraCondicionPago } from '@/types/inventario-obra';

export type LineaCompraInventarioInput = {
  material_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  requiere_serie?: boolean;
};

/**
 * Registra compra en compras_facturas y aplica stock en inventario_stock (trigger migr. 180).
 * No modifica global_inventory.stock_available (maestro SKU).
 */
export async function registrarCompraInventario(
  supabase: SupabaseClient,
  params: {
    ubicacionDestinoId: string;
    numeroFactura: string;
    proveedorRif?: string | null;
    proveedorNombre: string;
    fechaEmision: string;
    subtotal?: number;
    impuesto?: number;
    total: number;
    purchaseInvoiceId?: string | null;
    documentoStoragePath?: string | null;
    condicion_pago?: CompraCondicionPago;
    dias_credito?: number | null;
    lineas: LineaCompraInventarioInput[];
  },
): Promise<{ compraFacturaId: string }> {
  if (!params.lineas.length) {
    throw new Error('La compra de inventario requiere al menos una línea con material.');
  }

  const subtotal =
    params.subtotal ??
    params.lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);

  const { data: factura, error: fErr } = await supabase
    .from('compras_facturas')
    .insert({
      numero_factura: params.numeroFactura.trim().slice(0, 80) || 'S/N',
      proveedor_rif: (params.proveedorRif ?? 'S/R').trim().slice(0, 40) || null,
      proveedor_nombre: params.proveedorNombre.trim().slice(0, 200) || 'Proveedor',
      fecha_emision: params.fechaEmision.slice(0, 10),
      subtotal,
      impuesto: params.impuesto ?? 0,
      total: params.total,
      ubicacion_destino_id: params.ubicacionDestinoId,
      estado: 'borrador',
      purchase_invoice_id: params.purchaseInvoiceId ?? null,
      documento_storage_path: params.documentoStoragePath ?? null,
      condicion_pago: params.condicion_pago ?? 'contado',
      dias_credito:
        params.condicion_pago === 'credito' ? params.dias_credito ?? null : null,
    })
    .select('id')
    .single();

  if (fErr) {
    if (
      fErr.code === '23505' &&
      params.purchaseInvoiceId?.trim() &&
      /purchase_invoice|idx_compras_facturas_purchase_invoice/i.test(fErr.message ?? '')
    ) {
      const { data: existente } = await supabase
        .from('compras_facturas')
        .select('id')
        .eq('purchase_invoice_id', params.purchaseInvoiceId.trim())
        .maybeSingle();
      if (existente?.id) {
        return { compraFacturaId: String(existente.id) };
      }
    }
    if (fErr.code === '42P01') {
      throw new Error('Tabla compras_facturas no existe. Aplique la migración 180 o 197.');
    }
    if (/schema cache|could not find the table/i.test(fErr.message ?? '')) {
      throw new Error(
        `${fErr.message} Ejecute en Supabase SQL: notify pgrst, 'reload schema'; (migr. 197).`,
      );
    }
    throw new Error(fErr.message ?? 'Error al registrar compras_facturas.');
  }

  const facturaId = String((factura as { id: string }).id);

  const lineasPayload = params.lineas.map((l) => ({
    factura_id: facturaId,
    material_id: l.material_id,
    descripcion: l.descripcion.trim().slice(0, 500) || 'Ítem',
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    requiere_serie: Boolean(l.requiere_serie),
  }));

  const { error: lErr } = await supabase.from('compras_factura_lineas').insert(lineasPayload);
  if (lErr) throw new Error(lErr.message);

  const { error: regErr } = await supabase
    .from('compras_facturas')
    .update({ estado: 'registrada', updated_at: new Date().toISOString() })
    .eq('id', facturaId);

  if (regErr) throw new Error(regErr.message);

  return { compraFacturaId: facturaId };
}
