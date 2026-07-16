import { NextResponse } from 'next/server';
import { cargarCcoDashboard } from '@/lib/contabilidad/cargarCcoDashboard';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET dashboard CCO V4: KPIs oficiales/real + series para gráficos (datos CI). */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto')?.trim() || null;
    const devalRaw = searchParams.get('devaluacion');
    // Si no viene el query, el loader usa cco_proyecto_config.
    const devaluacionPromedio =
      devalRaw != null && devalRaw !== '' && Number.isFinite(Number(devalRaw))
        ? Number(devalRaw)
        : null;

    const data = await cargarCcoDashboard(admin.client, {
      proyectoId,
      devaluacionPromedio,
    });

    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar el dashboard CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
