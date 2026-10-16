import { NextResponse } from 'next/server';
import { loadEntidades } from '@/lib/almacen/inventoryClasificacion';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { PERMISOS } from '@/lib/auth/permisosCatalogo';
export const dynamic = 'force-dynamic';

/** GET /api/almacen/entidades — entidades de trabajo para despacho inter-entidad. */
export async function GET() {
  const acceso = await requireAlgunPermisoWeb(PERMISOS);
  if (!acceso.ok) return acceso.response;

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
