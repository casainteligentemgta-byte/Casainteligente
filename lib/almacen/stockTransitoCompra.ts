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
