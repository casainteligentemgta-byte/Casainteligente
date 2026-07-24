import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

/** Quita campos que no existen o no deben enviarse a contabilidad_compras. */
export function sanitizarPatchContabilidadCompra(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const { updated_at: _u, ...rest } = patch;
  return rest;
}

export async function updateContabilidadCompraRow(
  supabase: SupabaseClient,
  compraId: string,
  patch: Record<string, unknown>,
): Promise<{ error: PostgrestError | null }> {
  const body = sanitizarPatchContabilidadCompra(patch);
  const { error } = await supabase
    .from('contabilidad_compras')
    .update(body as never)
    .eq('id', compraId);
  return { error };
}
