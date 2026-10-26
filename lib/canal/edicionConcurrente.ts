import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Control de edición simultánea. La versión de una factura es `updated_at` de su fila en
 * ci_facturas_canal_pendientes: cada cambio (web o Telegram) la mueve. Quien guarda envía la
 * versión que tenía al abrir; si ya no coincide, el guardado se rechaza.
 */

export const MENSAJE_CONFLICTO_EDICION =
  'Otra persona cambió esta factura mientras la editaba. Recargue la factura antes de guardar.';

export class ConflictoEdicionError extends Error {
  constructor() {
    super(MENSAJE_CONFLICTO_EDICION);
    this.name = 'ConflictoEdicionError';
  }
}

/**
 * Compare-and-swap: marca la factura como editada solo si su versión sigue siendo la que
 * tenía quien guarda. Así dos guardados con la misma versión no pueden pasar los dos.
 */
export async function reclamarVersionPendiente(
  supabase: SupabaseClient,
  pendienteId: string,
  versionEsperada: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', pendienteId)
    .eq('updated_at', versionEsperada)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictoEdicionError();
}
