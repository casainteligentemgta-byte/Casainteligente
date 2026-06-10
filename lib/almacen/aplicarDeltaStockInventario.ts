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

/** D-11: no escribir inventario_stock sin ledger; exigir migr. 204. */
async function aplicarDeltaStockDirecto(
  _supabase: SupabaseClient,
  _params: AplicarDeltaStockParams,
): Promise<void> {
  throw new Error(
    'RPC inv_stock_apply_delta ambigua o no disponible. Aplique migraciones 203 y 204 en Supabase (ledger obligatorio).',
  );
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
