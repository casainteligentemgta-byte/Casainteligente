import { NextResponse } from 'next/server';
import { eliminarEmpleado } from '@/lib/rrhh/eliminarEmpleado';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/rrhh/empleados/[id]
 * Borra contratos/asignaciones hijas (RESTRICT) y luego `ci_empleados`.
 */
export async function DELETE(_req: Request, context: { params: { id: string } }) {
  const id = decodeURIComponent(context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  const supabase = admin.ok ? admin.client : supabaseAuth;

  const result = await eliminarEmpleado(supabase, id);
  if (!result.ok) {
    console.error('[api/rrhh/empleados DELETE]', id, result.step, result.error);
    const status =
      result.error.toLowerCase().includes('foreign key') ||
      result.error.toLowerCase().includes('violates')
        ? 409
        : 500;
    return NextResponse.json(
      {
        error: result.error,
        step: result.step,
        detail:
          'No se pudo eliminar el expediente. Se intentó borrar primero contratos y asignaciones vinculadas.',
      },
      { status },
    );
  }

  return NextResponse.json({ ok: true, id });
}
