import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Deja la foto en la transferencia. Si la columna `fotos` aún no existe en la base
 * (migración 340 sin aplicar) no se pierde la evidencia: la ruta queda en observaciones.
 */
export async function guardarFotoTransferencia(
  supabase: SupabaseClient,
  transferenciaId: string,
  foto: { storage_path: string; url: string },
  observaciones: string,
): Promise<void> {
  const { error } = await supabase
    .from('transferencias_inventario')
    .update({ fotos: [foto] })
    .eq('id', transferenciaId);
  if (!error) return;

  console.warn('[transferencia] columna fotos no disponible:', error.message);
  const conRuta = [observaciones, `Foto: ${foto.storage_path}`].filter(Boolean).join(' · ');
  const { error: obsError } = await supabase
    .from('transferencias_inventario')
    .update({ observaciones: conRuta })
    .eq('id', transferenciaId);
  if (obsError) {
    console.error('[transferencia] no se pudo guardar la foto:', obsError.message);
  }
}
