import { NextResponse } from 'next/server';
import { cargarOpcionesPartidaDespacho } from '@/lib/almacen/cargarPartidasDespacho';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const proyectoId = url.searchParams.get('proyecto_id')?.trim();
  const materialId = url.searchParams.get('material_id')?.trim();

  if (!proyectoId || !materialId) {
    return NextResponse.json(
      { error: 'Query proyecto_id y material_id son obligatorios.' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  try {
    const partidas = await cargarOpcionesPartidaDespacho(supabase, {
      proyectoId,
      materialId,
    });
    return NextResponse.json({ ok: true, partidas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar partidas';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
