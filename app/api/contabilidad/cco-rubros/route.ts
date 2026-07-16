import { NextResponse } from 'next/server';
import { cargarCcoListaRubros } from '@/lib/contabilidad/cargarCcoListaRubros';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET reporte Lista de Rubros por mes (CCO). */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto')?.trim() || null;
    const anioRaw = searchParams.get('anio');
    const anio =
      anioRaw != null && anioRaw !== '' && Number.isFinite(Number(anioRaw))
        ? Number(anioRaw)
        : null;

    const data = await cargarCcoListaRubros(admin.client, { proyectoId, anio });
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar la lista de rubros.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
