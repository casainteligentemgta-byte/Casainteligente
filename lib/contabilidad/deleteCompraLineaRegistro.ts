import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { deleteCompraRegistro } from '@/lib/contabilidad/deleteCompraRegistro';
import { monedaOriginalCompra } from '@/lib/contabilidad/monedaCompra';

export type DeleteCompraLineaResult = {
  deletedLineaId: string;
  compraId: string;
  compraEliminada?: boolean;
  materialPermaneceEnStock?: boolean;
};

type LineaRow = {
  id: string;
  compra_id: string;
  purchase_detail_id: string | null;
  material_id: string | null;
  cantidad: number;
  subtotal: number;
};

type CompraRow = {
  id: string;
  purchase_invoice_id: string | null;
  compra_factura_id: string | null;
  fecha: string;
  moneda: string | null;
  moneda_original: string | null;
  tasa_bcv_ves_por_usd: number | null;
  total_amount: number;
  monto_ves: number | null;
  monto_usd: number | null;
};

async function revertirStockLinea(
  supabase: SupabaseClient,
  ubicacionId: string,
  materialId: string,
  cantidad: number,
): Promise<void> {
  if (!ubicacionId || !materialId || cantidad <= 0) return;
  await aplicarDeltaStockInventario(supabase, {
    ubicacionId,
    materialId,
    deltaDisponible: -cantidad,
    tipoMovimiento: 'anulacion',
    notas: 'Eliminación de línea contable de compra',
  });
}

async function eliminarMaterialSiSinUso(
  supabase: SupabaseClient,
  materialId: string,
): Promise<void> {
  const { count: inspCount } = await supabase
    .from('quality_inspections')
    .select('id', { count: 'exact', head: true })
    .eq('material_id', materialId);

  if ((inspCount ?? 0) > 0) return;

  const { count: stockCount } = await supabase
    .from('inventario_stock')
    .select('id', { count: 'exact', head: true })
    .eq('material_id', materialId)
    .gt('cantidad_disponible', 0);

  if ((stockCount ?? 0) > 0) return;

  await supabase.from('global_inventory').delete().eq('id', materialId);
}

async function eliminarPurchaseDetail(
  supabase: SupabaseClient,
  purchaseDetailId: string,
  purchaseInvoiceId: string | null,
): Promise<{ materialYaEnStock: boolean }> {
  const { data: det, error: dErr } = await supabase
    .from('purchase_details')
    .select('id, material_id, quantity, invoice_id')
    .eq('id', purchaseDetailId)
    .maybeSingle();
  if (dErr) throw dErr;
  if (!det?.id) return { materialYaEnStock: false };

  const invoiceId = String(det.invoice_id ?? purchaseInvoiceId ?? '').trim();
  let ubicacionId = '';
  if (invoiceId) {
    const { data: inv } = await supabase
      .from('purchase_invoices')
      .select('ubicacion_destino_id')
      .eq('id', invoiceId)
      .maybeSingle();
    ubicacionId = String(inv?.ubicacion_destino_id ?? '').trim();
  }

  const { data: insp } = await supabase
    .from('quality_inspections')
    .select('status')
    .eq('purchase_detail_id', purchaseDetailId)
    .maybeSingle();

  const materialId = String(det.material_id ?? '').trim();
  const cantidad = Number(det.quantity ?? 0);
  const aprobado = insp?.status === 'APROBADO';

  if (aprobado && ubicacionId && materialId && cantidad > 0) {
    await revertirStockLinea(supabase, ubicacionId, materialId, cantidad);
  }

  await supabase.from('quality_inspections').delete().eq('purchase_detail_id', purchaseDetailId);
  const { error: delDetErr } = await supabase
    .from('purchase_details')
    .delete()
    .eq('id', purchaseDetailId);
  if (delDetErr) throw delDetErr;

  if (!aprobado && materialId) {
    await eliminarMaterialSiSinUso(supabase, materialId);
  }

  return { materialYaEnStock: false };
}

async function eliminarLineaInventarioContable(
  supabase: SupabaseClient,
  compraFacturaId: string,
  materialId: string | null,
): Promise<void> {
  const { data: cf, error: cfErr } = await supabase
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('id', compraFacturaId)
    .maybeSingle();
  if (cfErr) throw cfErr;
  if (!cf?.id) return;

  let q = supabase
    .from('compras_factura_lineas')
    .select('id, material_id, cantidad')
    .eq('factura_id', cf.id);
  if (materialId) q = q.eq('material_id', materialId);

  const { data: lineas, error: lnErr } = await q;
  if (lnErr) throw lnErr;

  const ubicacionId = String(cf.ubicacion_destino_id ?? '').trim();
  for (const ln of lineas ?? []) {
    const mat = String(ln.material_id ?? '').trim();
    const qty = Number(ln.cantidad ?? 0);
    if (cf.estado === 'registrada' && ubicacionId && mat && qty > 0) {
      await revertirStockLinea(supabase, ubicacionId, mat, qty);
    }
    await supabase.from('compras_factura_lineas').delete().eq('id', ln.id);
  }
}

async function recalcularTotalesCompra(
  supabase: SupabaseClient,
  compra: CompraRow,
): Promise<void> {
  const { data: lineas, error: lnErr } = await supabase
    .from('contabilidad_compra_lineas')
    .select('subtotal')
    .eq('compra_id', compra.id);
  if (lnErr) throw lnErr;

  const sumSubtotal = (lineas ?? []).reduce((acc, l) => acc + Number(l.subtotal ?? 0), 0);
  const montos = await resolverMontosCompraBimonetario({
    montoTotal: sumSubtotal,
    moneda: monedaOriginalCompra(compra),
    fecha: compra.fecha,
    tasaBcvDigitada: compra.tasa_bcv_ves_por_usd,
  });

  const { error: upErr } = await supabase
    .from('contabilidad_compras')
    .update(payloadCompraBimonetario(montos) as never)
    .eq('id', compra.id);
  if (upErr) throw upErr;
}

/**
 * Elimina una línea de contabilidad_compra_lineas y ajusta recepción/stock/totales.
 * Si era la única línea, elimina la compra completa.
 */
export async function deleteCompraLineaRegistro(
  supabase: SupabaseClient,
  compraId: string,
  lineaId: string,
): Promise<DeleteCompraLineaResult> {
  const { data: linea, error: lineaErr } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id, compra_id, purchase_detail_id, material_id, cantidad, subtotal')
    .eq('id', lineaId)
    .eq('compra_id', compraId)
    .maybeSingle();

  if (lineaErr) throw lineaErr;
  if (!linea?.id) throw new Error('Línea de compra no encontrada.');

  const { data: compra, error: compraErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id, purchase_invoice_id, compra_factura_id, fecha, moneda, moneda_original, tasa_bcv_ves_por_usd, total_amount, monto_ves, monto_usd',
    )
    .eq('id', compraId)
    .maybeSingle();

  if (compraErr) throw compraErr;
  if (!compra?.id) throw new Error('Compra no encontrada.');

  const { count, error: countErr } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id', { count: 'exact', head: true })
    .eq('compra_id', compraId);
  if (countErr) throw countErr;

  if ((count ?? 0) <= 1) {
    const r = await deleteCompraRegistro(supabase, compraId, {
      incluirDuplicadosMismaFactura: false,
    });
    return {
      deletedLineaId: lineaId,
      compraId,
      compraEliminada: true,
      materialPermaneceEnStock: r.materialPermaneceEnStock,
    };
  }

  const row = linea as LineaRow;
  const compraRow = compra as CompraRow;

  if (row.purchase_detail_id) {
    await eliminarPurchaseDetail(supabase, row.purchase_detail_id, compraRow.purchase_invoice_id);
  }

  if (compraRow.compra_factura_id) {
    await eliminarLineaInventarioContable(
      supabase,
      compraRow.compra_factura_id,
      row.material_id,
    );
  }

  const { error: delLineaErr } = await supabase
    .from('contabilidad_compra_lineas')
    .delete()
    .eq('id', lineaId);
  if (delLineaErr) throw delLineaErr;

  await recalcularTotalesCompra(supabase, compraRow);

  return {
    deletedLineaId: lineaId,
    compraId,
  };
}
