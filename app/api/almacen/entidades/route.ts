import { NextResponse } from 'next/server';
import { loadEntidades } from '@/lib/almacen/inventoryClasificacion';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

/** GET /api/almacen/entidades — entidades de trabajo para despacho inter-entidad. */
export async function GET() {
  try {
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const entidades = await loadEntidades(supabase);
    return NextResponse.json({ ok: true, entidades, total: entidades.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar entidades';
    console.error('[GET /api/almacen/entidades]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
