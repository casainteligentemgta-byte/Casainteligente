import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { loadCatalogoProyectosApp } from '@/lib/proyectos/proyectosUnificados';

export const dynamic = 'force-dynamic';

/** Catálogo de obras/proyectos para selects de almacén (despacho, compras, etc.). */
export async function GET() {
  try {
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const { proyectos, error } = await loadCatalogoProyectosApp(supabase);
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      proyectos,
      total: proyectos.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar proyectos';
    console.error('[GET /api/almacen/proyectos]', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
