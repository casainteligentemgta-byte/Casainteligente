import type { SupabaseClient } from '@supabase/supabase-js';

export const MENSAJE_FACTURA_DUPLICADA =
  'Esta factura ya fue cargada (mismo RIF y número). No se creó un registro duplicado.';

/** Violación de índice único de Postgres (código 23505): factura con mismo RIF + número. */
export function esErrorFacturaDuplicada(error: { code?: string } | null | undefined): boolean {
  return String(error?.code ?? '') === '23505';
}

/**
 * Marca la carga como duplicada. Estado `error` la saca del índice único, así que no bloquea
 * una carga válida futura; el motivo queda visible en la fila.
 */
export async function marcarPendienteDuplicado(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<void> {
  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'error',
      mensaje_error: MENSAJE_FACTURA_DUPLICADA,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);
}
