import { NextResponse } from 'next/server';
import { listarCapitulosDespacho } from '@/lib/almacen/listarCapitulosDespacho';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

/** Capítulos del presupuesto Lulo para selector de despacho web. */
export async function GET(req: Request) {
  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'Query proyecto_id es obligatorio.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const capitulos = await listarCapitulosDespacho(supabase, proyectoId);
    return NextResponse.json({ ok: true, capitulos, total: capitulos.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar capítulos';
    console.error('[GET /api/almacen/capitulos]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
