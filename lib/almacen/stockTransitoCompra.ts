import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';

export type LineaStockTransitoInput = {
  material_id: string;
  cantidad: number;
};

/** Compra confirmada: mercancía en tránsito (aún no disponible para despacho). */
export async function aplicarEntradaTransitoCompra(
  supabase: SupabaseClient,
  params: {
    ubicacionDestinoId: string;
    materialId: string;
    cantidad: number;
    purchaseInvoiceId?: string | null;
    referenciaId?: string | null;
  },
): Promise<void> {
  const ubicacionId = params.ubicacionDestinoId.trim();
  const materialId = params.materialId.trim();
  const cantidad = Number(params.cantidad);
  if (!ubicacionId || !materialId || !Number.isFinite(cantidad) || cantidad <= 0) return;

  await aplicarDeltaStockInventario(supabase, {
    ubicacionId,
    materialId,
    deltaTransitoEntrante: cantidad,
    tipoMovimiento: 'ingreso_compra',
    documentoId: params.purchaseInvoiceId?.trim() || null,
    referenciaTipo: 'quality_inspection',
    referenciaId: params.referenciaId?.trim() || null,
    notas: 'Entrada en tránsito (compra confirmada, pendiente recepción física)',
  });
}

export async function aplicarStockTransitoDesdeLineasCuarentena(
  supabase: SupabaseClient,
  params: {
    ubicacionDestinoId: string;
    purchaseInvoiceId?: string | null;
    lineas: LineaStockTransitoInput[];
  },
): Promise<void> {
  for (const l of params.lineas) {
    await aplicarEntradaTransitoCompra(supabase, {
      ubicacionDestinoId: params.ubicacionDestinoId,
      materialId: l.material_id,
      cantidad: l.cantidad,
      purchaseInvoiceId: params.purchaseInvoiceId,
    });
  }
}

/**
 * Recepción física / liberación: mueve de tránsito a disponible.
 * Si no había tránsito registrado (datos legacy), solo suma disponible.
 */
export async function aplicarLiberacionTransitoADisponible(
  supabase: SupabaseClient,
  params: {
    ubicacionDestinoId: string;
    materialId: string;
    cantidad: number;
    purchaseInvoiceId?: string | null;
    referenciaId?: string | null;
    referenciaTipo?: string | null;
  },
): Promise<void> {
  const ubicacionId = params.ubicacionDestinoId.trim();
  const materialId = params.materialId.trim();
  const cantidad = Number(params.cantidad);
  if (!ubicacionId || !materialId || !Number.isFinite(cantidad) || cantidad <= 0) return;

  const { data: row } = await supabase
    .from('inventario_stock')
    .select('cantidad_en_transito_entrante')
    .eq('ubicacion_id', ubicacionId)
    .eq('material_id', materialId)
    .maybeSingle();

  const transito = Number(row?.cantidad_en_transito_entrante ?? 0);
  const desdeTransito = Math.min(cantidad, Math.max(0, transito));

  await aplicarDeltaStockInventario(supabase, {
    ubicacionId,
    materialId,
    deltaDisponible: cantidad,
    deltaTransitoEntrante: desdeTransito > 0 ? -desdeTransito : 0,
    tipoMovimiento: 'ingreso_compra',
    documentoId: params.purchaseInvoiceId?.trim() || null,
    referenciaTipo: params.referenciaTipo ?? 'quality_inspection',
    referenciaId: params.referenciaId?.trim() || null,
    notas: 'Recepción física: tránsito → stock disponible',
  });
}

/**
 * Cuarentena rechazada o compra eliminada antes de recibirla: la mercancía ya no viene,
 * así que se descuenta el tránsito que se sumó al crear la cuarentena. Sin esto el
 * material quedaba «en tránsito» para siempre.
 *
 * Llamar ANTES de borrar la inspección (necesita leerla). No lanza.
 */
export async function revertirTransitoInspeccion(
  supabase: SupabaseClient,
  inspectionId: string,
  notas = 'Cuarentena rechazada: se descuenta el tránsito',
): Promise<void> {
  try {
    const { data: insp } = await supabase
      .from('quality_inspections')
      .select('id, material_id, quantity, invoice_id, purchase_detail_id')
      .eq('id', inspectionId.trim())
      .maybeSingle();
    const row = insp as {
      material_id: string | null;
      quantity: number | string | null;
      invoice_id: string | null;
      purchase_detail_id: string | null;
    } | null;
    const materialId = row?.material_id?.trim();
    const cantidad = Number(row?.quantity);
    if (!row?.invoice_id || !materialId || !Number.isFinite(cantidad) || cantidad <= 0) return;

    const { data: inv } = await supabase
      .from('purchase_invoices')
      .select('ubicacion_destino_id')
      .eq('id', row.invoice_id)
      .maybeSingle();
    const ubicacionId = String(inv?.ubicacion_destino_id ?? '').trim();
    if (!ubicacionId) return;

    // Los materiales de gasto inmediato nunca sumaron tránsito (ver crearCuarentenaDesdeFactura).
    const { materialEsGastoInmediato } = await import('@/lib/almacen/esGastoInmediatoCompra');
    if (await materialEsGastoInmediato(supabase, materialId)) return;

    await aplicarDeltaStockInventario(supabase, {
      ubicacionId,
      materialId,
      deltaTransitoEntrante: -cantidad,
      tipoMovimiento: 'anulacion',
      documentoId: row.invoice_id,
      referenciaTipo: 'quality_inspection',
      referenciaId: row.purchase_detail_id ?? null,
      notas,
    });
  } catch (e) {
    console.warn('[revertirTransitoInspeccion]', inspectionId, e);
  }
}
