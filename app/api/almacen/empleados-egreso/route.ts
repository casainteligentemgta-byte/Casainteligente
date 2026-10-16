import { NextResponse } from 'next/server';
import { listarEmpleadosProyectoEgreso } from '@/lib/almacen/listarEmpleadosProyectoEgreso';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { PERMISOS } from '@/lib/auth/permisosCatalogo';
export const dynamic = 'force-dynamic';

/** GET /api/almacen/empleados-egreso?proyecto_id= — obreros de nómina del proyecto. */
export async function GET(req: Request) {
  const acceso = await requireAlgunPermisoWeb(PERMISOS);
  if (!acceso.ok) return acceso.response;

  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 });
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
  try {
    const empleados = await listarEmpleadosProyectoEgreso(supabase, proyectoId);
    return NextResponse.json({ ok: true, empleados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar empleados';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
