import type { SupabaseClient } from '@supabase/supabase-js';

/** Despacha y recibe en una sola operación (pendiente → en_transito → completado). */
export async function completarTransferenciaInventario(
  supabase: SupabaseClient,
  transferenciaId: string,
): Promise<void> {
  const id = transferenciaId.trim();
  if (!id) throw new Error('ID de transferencia inválido.');

  const { data: actual, error: selErr } = await supabase
    .from('transferencias_inventario')
    .select('estado')
    .eq('id', id)
    .maybeSingle();

  if (selErr?.code === '42P01') {
    throw new Error('Módulo de transferencias no instalado. Aplique migración 180.');
  }
  if (selErr) throw new Error(selErr.message);

  const estadoActual = String(actual?.estado ?? '');
  if (estadoActual === 'completado') return;

  if (estadoActual !== 'pendiente') {
    throw new Error(
      `La transferencia está en estado «${estadoActual}»; no se pudo aplicar el movimiento de stock.`,
    );
  }

  const { data: enTransito, error: e1 } = await supabase
    .from('transferencias_inventario')
    .update({ estado: 'en_transito', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('id')
    .maybeSingle();

  if (e1) throw new Error(e1.message);
  if (!enTransito?.id) {
    throw new Error('No se pudo despachar la transferencia (stock no descontado en origen).');
  }

  const { data: completado, error: e2 } = await supabase
    .from('transferencias_inventario')
    .update({ estado: 'completado', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('estado', 'en_transito')
    .select('id')
    .maybeSingle();

  if (e2) throw new Error(e2.message);
  if (!completado?.id) {
    throw new Error('No se pudo completar la transferencia (stock no ingresó al destino).');
  }
}
