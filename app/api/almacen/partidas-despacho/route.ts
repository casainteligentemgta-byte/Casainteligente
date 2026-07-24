import { NextResponse } from 'next/server';
import { cargarOpcionesPartidaDespacho } from '@/lib/almacen/cargarPartidasDespacho';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const proyectoId = url.searchParams.get('proyecto_id')?.trim();
  const materialId = url.searchParams.get('material_id')?.trim();
  const scope = (url.searchParams.get('scope') ?? 'related').trim().toLowerCase();
  const soloRelacionadas = scope !== 'all';

  if (!proyectoId) {
    return NextResponse.json(
      { error: 'Query proyecto_id es obligatorio.' },
      { status: 400 },
    );
  }
  if (soloRelacionadas && !materialId) {
    return NextResponse.json(
      { error: 'Query material_id es obligatorio cuando scope=related.' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  try {
    const partidas = await cargarOpcionesPartidaDespacho(supabase, {
      proyectoId,
      materialId,
      soloRelacionadas,
    });
    return NextResponse.json({ ok: true, scope: soloRelacionadas ? 'related' : 'all', partidas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar partidas';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
