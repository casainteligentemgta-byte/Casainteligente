import type { SupabaseClient } from '@supabase/supabase-js';

/** Despacha y recibe en una sola operación (pendiente → en_transito → completado). */
export async function completarTransferenciaInventario(
  supabase: SupabaseClient,
  transferenciaId: string,
): Promise<void> {
  const id = transferenciaId.trim();
  if (!id) throw new Error('ID de transferencia inválido.');

  const { error: e1 } = await supabase
    .from('transferencias_inventario')
    .update({ estado: 'en_transito', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('estado', 'pendiente');

  if (e1?.code === '42P01') {
    throw new Error('Módulo de transferencias no instalado. Aplique migración 180.');
  }
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase
    .from('transferencias_inventario')
    .update({ estado: 'completado', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('estado', 'en_transito');

  if (e2) throw new Error(e2.message);
}
