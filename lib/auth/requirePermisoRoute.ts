import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Permiso } from '@/lib/auth/permisosCatalogo';
import {
  type ActorPermisos,
  permisosEnforcementActivo,
  resolverActorWeb,
} from '@/lib/auth/permisos';

export type RequirePermisoOk = {
  ok: true;
  actor: ActorPermisos;
  supabase: SupabaseClient;
  userId: string;
};

export type RequirePermisoFail = {
  ok: false;
  response: NextResponse;
};

export async function requirePermisoWeb(
  permiso: Permiso,
  ctx?: { proyectoId?: string | null; entidadId?: string | null },
): Promise<RequirePermisoOk | RequirePermisoFail> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 }),
    };
  }

  const actor = await resolverActorWeb(supabase, user.id, user.email);

  if (!permisosEnforcementActivo()) {
    return { ok: true, actor, supabase, userId: user.id };
  }

  const { actorTienePermiso } = await import('@/lib/auth/permisos');
  if (!actorTienePermiso(actor, permiso, ctx)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'No tiene permiso para esta acción',
          permiso_requerido: permiso,
          roles_empresa: actor.rolesEmpresa,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, actor, supabase, userId: user.id };
}
