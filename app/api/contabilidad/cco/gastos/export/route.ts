import { NextResponse } from 'next/server';
import { exportCsvMaestro } from '@/lib/contabilidad/cco/exportCsvMaestro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/contabilidad/cco/gastos/export?proyecto=UUID
 * CSV maestro 25 columnas (compatible Streamlit V4).
 */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const proyectoId = String(
      searchParams.get('proyecto') ?? searchParams.get('proyectoId') ?? '',
    ).trim();
    if (!proyectoId) {
      return NextResponse.json(
        { ok: false, error: 'Falta ?proyecto= (obra).' },
        { status: 400 },
      );
    }

    const { csv, count } = await exportCsvMaestro(admin.client, proyectoId);
    const filename = `CCO_maestro_${proyectoId.slice(0, 8)}_${count}filas.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-CCO-Export-Count': String(count),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al exportar CSV.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
