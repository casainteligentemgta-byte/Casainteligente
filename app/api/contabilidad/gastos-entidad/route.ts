import { NextResponse } from 'next/server';
import { cargarResumenGastosEntidad } from '@/lib/contabilidad/resumenGastosEntidad';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function mesActualRango(): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const ultimo = new Date(y, now.getMonth() + 1, 0).getDate();
  return { desde: `${y}-${m}-01`, hasta: `${y}-${m}-${String(ultimo).padStart(2, '0')}` };
}

/** GET resumen de gastos imputados a entidad (OpEx patrono). */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const entidadId = searchParams.get('entidad_id')?.trim() || null;
    const rangoDefault = mesActualRango();
    const fechaDesde = (searchParams.get('desde') ?? rangoDefault.desde).slice(0, 10);
    const fechaHasta = (searchParams.get('hasta') ?? rangoDefault.hasta).slice(0, 10);

    const resumen = await cargarResumenGastosEntidad(admin.client, {
      entidadId,
      fechaDesde,
      fechaHasta,
    });

    const entidadIds = Array.from(
      new Set(resumen.filas.map((f) => f.entidad_id).filter(Boolean)),
    ) as string[];
    let entidadesMap: Record<string, string> = {};
    if (entidadIds.length) {
      const { data: entRows } = await admin.client
        .from('ci_entidades')
        .select('id,nombre')
        .in('id', entidadIds.slice(0, 100));
      entidadesMap = Object.fromEntries(
        (entRows ?? []).map((e: { id: string; nombre: string | null }) => [
          e.id,
          (e.nombre ?? 'Entidad').trim(),
        ]),
      );
    }

    return NextResponse.json({
      ok: true,
      fechaDesde,
      fechaHasta,
      entidadId,
      entidadesMap,
      ...resumen,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo cargar el reporte.';
    const hint = /clasificacion_gasto_entidad/i.test(message)
      ? 'Ejecute la migración 222_compras_clasificacion_gasto_entidad.sql en Supabase.'
      : undefined;
    return NextResponse.json({ error: message, hint }, { status: 500 });
  }
}
