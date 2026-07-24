import { NextResponse } from 'next/server';
import { cargarRubrosCco } from '@/lib/contabilidad/cco/cargarRubros';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';

export const dynamic = 'force-dynamic';

/** GET ?proyecto= — desglose Lista de Rubros V4 (KPIs, pie, consolidado, transacciones). */
export async function GET(req: Request) {
  try {
    const accesoCco = await requireCcoAcceso('ver');
    if (!accesoCco.ok) return accesoCco.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const data = await cargarRubrosCco(admin.client, proyectoId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar rubros CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
