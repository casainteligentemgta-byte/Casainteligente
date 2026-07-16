import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';

export const dynamic = 'force-dynamic';

/** GET — Listado de asignaciones ci_usuarios_roles (requiere admin o equipo.gestionar). */
export async function GET() {
  const auth = await requirePermisoWeb('equipo.gestionar');
  if (!auth.ok) {
    const adminAuth = await requirePermisoWeb('admin.config');
    if (!adminAuth.ok) return auth.response;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ci_usuarios_roles')
    .select('id, rol, entidad_id, created_at, ci_entidades(nombre)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, filas: data ?? [] });
}
