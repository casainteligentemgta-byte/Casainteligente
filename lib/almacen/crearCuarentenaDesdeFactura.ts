import type { SupabaseClient } from '@supabase/supabase-js';
import { materialEsGastoInmediato } from '@/lib/almacen/esGastoInmediatoCompra';
import { aplicarEntradaTransitoCompra } from '@/lib/almacen/stockTransitoCompra';

export type LineaCuarentenaInput = {
  material_id: string;
  descripcion: string;
  item_code?: string | null;
  cantidad: number;
  precio_unitario: number;
  unidad?: string;
};

export type ResultadoCuarentenaFactura = {
  lineasCreadas: number;
  yaExistia: boolean;
};

/**
 * Crea purchase_details + quality_inspections PENDIENTE para una factura.
 * Idempotente: si ya hay líneas con inspección, no duplica.
 */
export async function crearCuarentenaDesdeFactura(
  supabase: SupabaseClient,
  params: {
    purchaseInvoiceId: string;
    ubicacionDestinoId?: string | null;
    lineas: LineaCuarentenaInput[];
  },
): Promise<ResultadoCuarentenaFactura> {
  const invoiceId = params.purchaseInvoiceId.trim();
  if (!invoiceId) {
    throw new Error('purchaseInvoiceId requerido.');
  }

  let ubicacionDestinoId = params.ubicacionDestinoId?.trim() || '';
  if (!ubicacionDestinoId) {
    const { data: inv } = await supabase
      .from('purchase_invoices')
      .select('ubicacion_destino_id')
      .eq('id', invoiceId)
      .maybeSingle();
    ubicacionDestinoId = String(inv?.ubicacion_destino_id ?? '').trim();
  }

  const lineasValidas = params.lineas.filter(
    (l) => l.material_id?.trim() && l.descripcion?.trim() && Number(l.cantidad) > 0,
  );
  if (!lineasValidas.length) {
    return { lineasCreadas: 0, yaExistia: false };
  }

  const { count: existentes, error: countErr } = await supabase
    .from('quality_inspections')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoiceId);

  if (countErr && !/does not exist/i.test(countErr.message ?? '')) {
    throw new Error(countErr.message);
  }
  if ((existentes ?? 0) > 0) {
    return { lineasCreadas: 0, yaExistia: true };
  }

  let creadas = 0;

  for (const linea of lineasValidas) {
    const desc = linea.descripcion.trim();
    const qty = Number(linea.cantidad);
    const unitPrice = Number(linea.precio_unitario) || 0;

    const { data: detailData, error: detailError } = await supabase
      .from('purchase_details')
      .insert({
        invoice_id: invoiceId,
        material_id: linea.material_id.trim(),
        description: desc,
        item_code: linea.item_code?.trim() || null,
        quantity: qty,
        unit_price: unitPrice,
        total_price: qty * unitPrice,
      })
      .select('id')
      .single();

    if (detailError) throw new Error(detailError.message);

    const detailId = String((detailData as { id: string }).id);

    const { error: qualityError } = await supabase.from('quality_inspections').insert({
      invoice_id: invoiceId,
      material_id: linea.material_id.trim(),
      quantity: qty,
      purchase_detail_id: detailId,
      status: 'PENDIENTE',
      line_description: desc,
    });

    if (qualityError) throw new Error(qualityError.message);

    if (ubicacionDestinoId) {
      const gastoInmediato = await materialEsGastoInmediato(supabase, linea.material_id.trim());
      if (!gastoInmediato) {
        await aplicarEntradaTransitoCompra(supabase, {
          ubicacionDestinoId,
          materialId: linea.material_id.trim(),
          cantidad: qty,
          purchaseInvoiceId: invoiceId,
          referenciaId: detailId,
        });
      }
    }

    creadas += 1;
  }

  await supabase
    .from('purchase_invoices')
    .update({ status: 'PENDIENTE' })
    .eq('id', invoiceId);

  return { lineasCreadas: creadas, yaExistia: false };
}
