import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoMovimientoInventario =
  | 'ingreso_compra'
  | 'transferencia_salida'
  | 'transferencia_entrada'
  | 'recepcion_campo'
  | 'salida_obra'
  | 'ajuste'
  | 'anulacion';

export type AplicarDeltaStockParams = {
  ubicacionId: string;
  materialId: string;
  deltaDisponible?: number;
  deltaReservada?: number;
  deltaTransitoEntrante?: number;
  tipoMovimiento?: TipoMovimientoInventario;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  documentoId?: string | null;
  notas?: string | null;
};

function rpcAmbiguo(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST203' ||
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /not unique|could not choose|schema cache/i.test(msg)
  );
}

/** Actualiza inventario_stock sin RPC (fallback si PostgREST no resuelve la función). */
async function aplicarDeltaStockDirecto(
  supabase: SupabaseClient,
  params: AplicarDeltaStockParams,
): Promise<void> {
  const dDisp = params.deltaDisponible ?? 0;
  const dRes = params.deltaReservada ?? 0;
  const dTrans = params.deltaTransitoEntrante ?? 0;

  const { data: row, error: readErr } = await supabase
    .from('inventario_stock')
    .select('id, cantidad_disponible, cantidad_reservada, cantidad_en_transito_entrante')
    .eq('ubicacion_id', params.ubicacionId)
    .eq('material_id', params.materialId)
    .maybeSingle();

  if (readErr?.code === '42P01') {
    throw new Error('Tabla inventario_stock no disponible. Aplique migración 180 en Supabase.');
  }
  if (readErr) throw readErr;

  if (!row?.id) {
    if (dDisp <= 0 && dRes <= 0 && dTrans <= 0) return;
    const { error: insErr } = await supabase.from('inventario_stock').insert({
      ubicacion_id: params.ubicacionId,
      material_id: params.materialId,
      cantidad_disponible: Math.max(0, dDisp),
      cantidad_reservada: Math.max(0, dRes),
      cantidad_en_transito_entrante: Math.max(0, dTrans),
    });
    if (insErr) throw insErr;
    return;
  }

  const { error: updErr } = await supabase
    .from('inventario_stock')
    .update({
      cantidad_disponible: Math.max(0, Number(row.cantidad_disponible) + dDisp),
      cantidad_reservada: Math.max(0, Number(row.cantidad_reservada ?? 0) + dRes),
      cantidad_en_transito_entrante: Math.max(0, Number(row.cantidad_en_transito_entrante ?? 0) + dTrans),
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (updErr) throw updErr;
}

/**
 * Wrapper de inv_stock_apply_delta (migr. 180/203).
 * Usa la firma de 10 parámetros para evitar ambigüedad PostgREST (PGRST203).
 */
export async function aplicarDeltaStockInventario(
  supabase: SupabaseClient,
  params: AplicarDeltaStockParams,
): Promise<void> {
  const payload = {
    p_ubicacion_id: params.ubicacionId,
    p_material_id: params.materialId,
    p_delta_disponible: params.deltaDisponible ?? 0,
    p_delta_reservada: params.deltaReservada ?? 0,
    p_delta_transito_entrante: params.deltaTransitoEntrante ?? 0,
    p_tipo_movimiento: params.tipoMovimiento ?? 'ajuste',
    p_referencia_tipo: params.referenciaTipo ?? null,
    p_referencia_id: params.referenciaId ?? null,
    p_documento_id: params.documentoId ?? null,
    p_notas: params.notas ?? null,
  };

  const { error: rpcErr } = await supabase.rpc('inv_stock_apply_delta', payload);
  if (!rpcErr) return;

  if (rpcAmbiguo(rpcErr)) {
    await aplicarDeltaStockDirecto(supabase, params);
    return;
  }

  throw rpcErr;
}
