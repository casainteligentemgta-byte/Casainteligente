import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  PERMISOS,
  ROLES_EMPRESA,
  PERMISOS_POR_ROL_OBRA,
} from '@/lib/auth/permisosCatalogo';
import {
  ampliarModulosPorPermisos,
  modulosParaRolesEmpresa,
  MODULOS_NAV,
} from '@/lib/auth/modulosPorRol';
import {
  permisosActorComoLista,
  permisosEnforcementActivo,
  resolverActorWeb,
} from '@/lib/auth/permisos';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { resolverAccesoLegal } from '@/lib/legal/accesoLegal';

export const dynamic = 'force-dynamic';

/** GET — Permisos efectivos del usuario en sesión. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const actor = await resolverActorWeb(supabase, user.id, user.email);
  const permisos = permisosActorComoLista(actor);
  const modulosSet = ampliarModulosPorPermisos(
    modulosParaRolesEmpresa(actor.rolesEmpresa),
    permisos,
  );

  const admin = createSupabaseAdminOnlyClient() ?? supabase;
  const accesoLegal = await resolverAccesoLegal(admin, user.id, user.email);
  if (accesoLegal.ok) {
    modulosSet.add('legal');
  }

  const modulos = Array.from(modulosSet);

  return NextResponse.json({
    ok: true,
    enforcement: permisosEnforcementActivo(),
    usuario: { id: user.id, email: user.email },
    roles_empresa: actor.rolesEmpresa,
    roles_obra: actor.rolesObra,
    permisos,
    modulos,
    acceso_legal: accesoLegal.ok,
    legal: accesoLegal.ok
      ? { org_id: accesoLegal.orgId, rol: accesoLegal.rolLegal, motivo: accesoLegal.motivo }
      : null,
    catalogo: {
      permisos: PERMISOS,
      roles_empresa: ROLES_EMPRESA,
      permisos_por_rol_obra: PERMISOS_POR_ROL_OBRA,
      modulos_nav: MODULOS_NAV,
    },
  });
}
