import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { relacionSemanalObra } from '@/lib/contabilidad/relacionGastosDatos';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';

export const dynamic = 'force-dynamic';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?proyecto_id=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD — relación de gastos de una semana. Requiere permiso de contabilidad. */
export async function GET(request: NextRequest) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'cco.ver']);
  if (!acceso.ok) return acceso.response;

  const sp = request.nextUrl.searchParams;
  const proyectoId = sp.get('proyecto_id') ?? '';
  const desde = sp.get('desde') ?? '';
  const hasta = sp.get('hasta') ?? '';
  if (!proyectoId || !FECHA.test(desde) || !FECHA.test(hasta) || desde > hasta) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }
  try {
    const relacion = await relacionSemanalObra(createSupabaseAdminClient(), { proyectoId, desde, hasta });
    return NextResponse.json(relacion, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al calcular' },
      { status: 500 },
    );
  }
}
