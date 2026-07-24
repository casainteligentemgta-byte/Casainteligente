import { NextResponse } from 'next/server';
import { listarPartidasCapituloDespacho } from '@/lib/almacen/listarPartidasCapituloDespacho';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

/** Partidas de un capítulo para imputación opcional en despacho web. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const proyectoId = url.searchParams.get('proyecto_id')?.trim();
  const capituloId = url.searchParams.get('capitulo_id')?.trim();

  if (!proyectoId || !capituloId) {
    return NextResponse.json(
      { error: 'Query proyecto_id y capitulo_id son obligatorios.' },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const partidas = await listarPartidasCapituloDespacho(supabase, proyectoId, capituloId);
    return NextResponse.json({ ok: true, partidas, total: partidas.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar partidas';
    console.error('[GET /api/almacen/partidas-capitulo]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
