import type { SupabaseClient } from '@supabase/supabase-js';
import { recalcularTotalesCompraContable } from '@/lib/contabilidad/recalcularTotalesCompraContable';

export type UpdateCompraLineaInput = {
  descripcion: string;
  item_code?: string | null;
  cantidad: number;
  precio_unitario: number;
};

export type UpdateCompraLineaResult = {
  lineaId: string;
  compraId: string;
  subtotal: number;
};

export async function updateCompraLineaRegistro(
  supabase: SupabaseClient,
  compraId: string,
  lineaId: string,
  input: UpdateCompraLineaInput,
): Promise<UpdateCompraLineaResult> {
  const descripcion = input.descripcion.trim();
  if (!descripcion) throw new Error('Indique la descripción del artículo.');

  const cantidad = Number(input.cantidad);
  const precio_unitario = Number(input.precio_unitario);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }
  if (!Number.isFinite(precio_unitario) || precio_unitario < 0) {
    throw new Error('El precio unitario no es válido.');
  }

  const subtotal = Math.round(cantidad * precio_unitario * 100) / 100;
  const item_code = input.item_code?.trim() || null;

  const { data: linea, error: lineaErr } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id, compra_id, purchase_detail_id')
    .eq('id', lineaId)
    .eq('compra_id', compraId)
    .maybeSingle();

  if (lineaErr) throw lineaErr;
  if (!linea?.id) throw new Error('Línea de compra no encontrada.');

  const { error: upLineaErr } = await supabase
    .from('contabilidad_compra_lineas')
    .update({
      descripcion,
      item_code,
      cantidad,
      precio_unitario,
      subtotal,
    } as never)
    .eq('id', lineaId);
  if (upLineaErr) throw upLineaErr;

  const purchaseDetailId = String(linea.purchase_detail_id ?? '').trim();
  if (purchaseDetailId) {
    const { error: pdErr } = await supabase
      .from('purchase_details')
      .update({
        quantity: cantidad,
        unit_price: precio_unitario,
        description: descripcion,
      } as never)
      .eq('id', purchaseDetailId);
    if (pdErr) {
      console.warn('[updateCompraLinea] purchase_details:', pdErr.message);
    }
  }

  const { data: compra, error: compraErr } = await supabase
    .from('contabilidad_compras')
    .select('id, fecha, total_amount, moneda, moneda_original, tasa_bcv_ves_por_usd')
    .eq('id', compraId)
    .maybeSingle();
  if (compraErr) throw compraErr;
  if (!compra?.id) throw new Error('Compra no encontrada.');

  await recalcularTotalesCompraContable(supabase, compra);

  return { lineaId, compraId, subtotal };
}
