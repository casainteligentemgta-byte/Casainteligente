import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listarAsignacionesRolesEmpresa } from '@/lib/auth/ciUsuariosRolesDb';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

/** GET — Listado de asignaciones ci_usuarios_roles (requiere admin o equipo.gestionar). */
export async function GET() {
  const auth = await requirePermisoWeb('equipo.gestionar');
  let sessionClient: SupabaseClient | null = null;

  if (auth.ok) {
    sessionClient = auth.supabase;
  } else {
    const adminAuth = await requirePermisoWeb('admin.config');
    if (!adminAuth.ok) return auth.response;
    sessionClient = adminAuth.supabase;
  }

  // Preferir service_role tras el gate: evita recursión RLS en ci_usuarios_roles.
  const admin = createSupabaseAdminOnlyClient();
  const client = admin ?? sessionClient;
  if (!client) {
    return NextResponse.json(
      { error: 'Falta cliente Supabase (service role o sesión) para listar roles' },
      { status: 503 },
    );
  }

  const { data, error } = await listarAsignacionesRolesEmpresa(client);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, filas: data });
}
