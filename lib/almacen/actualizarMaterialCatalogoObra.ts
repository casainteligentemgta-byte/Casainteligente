import type { SupabaseClient } from '@supabase/supabase-js';

export async function actualizarMaterialCatalogoObra(
  supabase: SupabaseClient,
  materialId: string,
  opts: {
    proyectoId: string;
    name: string;
    unit: string;
    sap_code?: string | null;
  },
): Promise<void> {
  const name = opts.name.trim();
  if (name.length < 2) {
    throw new Error('Indique un nombre de al menos 2 caracteres.');
  }

  const patch: Record<string, unknown> = {
    name,
    unit: (opts.unit || 'UND').trim() || 'UND',
    sap_code: opts.sap_code?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('global_inventory')
    .update(patch)
    .eq('id', materialId)
    .eq('proyecto_id', opts.proyectoId.trim());

  if (error) throw new Error(error.message);
}
