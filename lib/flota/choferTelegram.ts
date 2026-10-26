import type { SupabaseClient } from '@supabase/supabase-js';

/** Respuesta cuando el chofer intenta algo fuera de la carga de facturas y notas con foto. */
export const MENSAJE_SOLO_FOTO_CHOFER =
  '🚚 Como chofer solo puede cargar <b>facturas y notas con foto</b>. Use /facturas.';

/** Acciones del menú de carga que el chofer puede usar. */
const ACCIONES_CARGA_CHOFER = new Set(['factura_ia', 'nota']);

/**
 * El chat pertenece a un conductor activo de la flota (`ci_flota_conductores.telegram_chat_id`).
 * Ante cualquier error responde false: nunca concede acceso por accidente.
 */
export async function esChatChofer(supabase: SupabaseClient, chatId: string | number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ci_flota_conductores')
      .select('id')
      .eq('telegram_chat_id', Number(chatId))
      .eq('activo', true)
      .limit(1);
    return !error && (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Callbacks que el chofer puede pulsar. En el menú de carga solo factura por foto y nota;
 * el resto de callbacks (selectores de obra, foto, confirmaciones) son pasos de esas dos
 * acciones y se permiten.
 */
export function callbackPermitidoChofer(data: string): boolean {
  if (data.startsWith('cg:')) return ACCIONES_CARGA_CHOFER.has(data.slice('cg:'.length));
  return true;
}
