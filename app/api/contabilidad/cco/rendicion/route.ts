import { NextResponse } from 'next/server';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';
import { cargarRendicionHonorarios } from '@/lib/contabilidad/cco/cargarRendicionHonorarios';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { leerParametrosRendicion } from '@/lib/contabilidad/cco/parametrosRendicion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET rendición de cuentas de una obra (administración delegada).
 * Sin ?proyecto= devuelve solo la lista de obras para el selector.
 */
export async function GET(req: Request) {
  try {
    const acceso = await requireCcoAcceso('ver');
    if (!acceso.ok) return acceso.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const params = leerParametrosRendicion(req.url);

    if (!params.proyectoId) {
      const { data, error } = await admin.client
        .from('ci_proyectos')
        .select('id,nombre')
        .order('nombre')
        .limit(500);
      if (error) throw new Error(error.message);
      const proyectos = (data ?? []).map((p) => ({
        id: String((p as { id: string }).id),
        nombre: String((p as { nombre?: string | null }).nombre ?? '').trim() || 'Obra',
      }));
      return NextResponse.json({ ok: true, proyectos });
    }

    const cargada = await cargarRendicionHonorarios(admin.client, {
      proyectoId: params.proyectoId,
      periodo: params.periodo,
      fecha: params.fecha,
    });
    if (!cargada) {
      return NextResponse.json({ ok: false, error: 'No se encontró la obra.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, fecha: params.fecha, ...cargada });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al preparar la rendición.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
