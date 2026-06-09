import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  PERMISOS,
  ROLES_EMPRESA,
  PERMISOS_POR_ROL_OBRA,
} from '@/lib/auth/permisosCatalogo';
import {
  permisosActorComoLista,
  permisosEnforcementActivo,
  resolverActorWeb,
} from '@/lib/auth/permisos';

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

  return NextResponse.json({
    ok: true,
    enforcement: permisosEnforcementActivo(),
    usuario: { id: user.id, email: user.email },
    roles_empresa: actor.rolesEmpresa,
    roles_obra: actor.rolesObra,
    permisos: permisosActorComoLista(actor),
    catalogo: {
      permisos: PERMISOS,
      roles_empresa: ROLES_EMPRESA,
      permisos_por_rol_obra: PERMISOS_POR_ROL_OBRA,
    },
  });
}
