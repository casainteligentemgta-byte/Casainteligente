import { NextResponse } from 'next/server';
import { listarPartidasProyectoDespacho } from '@/lib/almacen/listarPartidasProyectoDespacho';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

/** Partidas del presupuesto Lulo (nativo + cascada MDB) para selector de destino en despacho. */
export async function GET(req: Request) {
  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'Query proyecto_id es obligatorio.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const partidas = await listarPartidasProyectoDespacho(supabase, proyectoId);
    return NextResponse.json({ ok: true, partidas, total: partidas.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar partidas';
    console.error('[GET /api/almacen/partidas-proyecto]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
