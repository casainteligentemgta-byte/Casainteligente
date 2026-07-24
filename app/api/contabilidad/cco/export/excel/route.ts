import { NextResponse } from 'next/server';
import { cargarLibroMaestro } from '@/lib/contabilidad/cco/cargarLibroMaestro';
import { cargarJerarquiaContratos } from '@/lib/contabilidad/cco/contratosJerarquia';
import { cargarPresupuestosCco } from '@/lib/contabilidad/cco/cargarPresupuestos';
import { generarExcelMaestroXml } from '@/lib/contabilidad/cco/exportExcelMaestro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET ?proyecto= — Excel SpreadsheetML (Gastos/Ingresos/Contratos/Presupuestos). */
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

    const { data: proy } = await admin.client
      .from('ci_proyectos')
      .select('nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    const obra = String((proy as { nombre?: string } | null)?.nombre ?? 'Obra').trim() || 'Obra';

    const [libro, jer, presup] = await Promise.all([
      cargarLibroMaestro(admin.client, { proyectoId, limit: 5000 }),
      cargarJerarquiaContratos(admin.client, proyectoId),
      cargarPresupuestosCco(admin.client, proyectoId),
    ]);

    const xml = generarExcelMaestroXml({
      obra,
      libro: libro.filas,
      contratos: jer.porProveedor,
      presupuestos: presup.filas,
    });

    const safeName = obra.replace(/[^\w\-]+/g, '_').slice(0, 40);
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="CCO_maestro_${safeName}.xls"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al exportar Excel CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
