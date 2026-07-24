import type { SupabaseClient } from '@supabase/supabase-js';

function normalizarRif(rif: string): string {
  return rif.trim().toUpperCase().replace(/[\s.-]/g, '');
}

/**
 * Resuelve empresas.id por RIF o nombre (proveedor de compras / FRM).
 */
export async function resolverProveedorIdPorRifNombre(
  supabase: SupabaseClient,
  params: { rif?: string | null; nombre?: string | null },
): Promise<string | null> {
  const rifNorm = params.rif?.trim() ? normalizarRif(params.rif) : '';
  if (rifNorm.length >= 4) {
    const { data: porRif } = await supabase
      .from('empresas')
      .select('id,rif')
      .not('rif', 'is', null)
      .limit(50);

    if (porRif?.length) {
      const hit = porRif.find((e) => normalizarRif(String(e.rif ?? '')) === rifNorm);
      if (hit?.id) return String(hit.id);
    }
  }

  const nombre = params.nombre?.trim();
  if (nombre && nombre.length >= 3) {
    const { data } = await supabase
      .from('empresas')
      .select('id')
      .ilike('nombre', `%${nombre}%`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  return null;
}
