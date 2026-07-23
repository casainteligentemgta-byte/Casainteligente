import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  actorEsSoloVistaEmpresa,
  type Permiso,
} from '@/lib/auth/permisosCatalogo';
import {
  type ActorPermisos,
  actorTienePermiso,
  permisosEnforcementActivo,
  resolverActorWeb,
} from '@/lib/auth/permisos';

export type RequireCcoOk = {
  ok: true;
  actor: ActorPermisos;
  supabase: SupabaseClient;
  userId: string;
  soloLectura: boolean;
};

export type RequireCcoFail = {
  ok: false;
  response: NextResponse;
};

/**
 * Acceso a APIs CCO.
 * - Siempre exige sesión.
 * - Roles solo-vista (cco_lectura / solo_lectura) nunca pueden editar.
 * - Con enforcement activo exige cco.ver / cco.editar.
 */
export async function requireCcoAcceso(
  modo: 'ver' | 'editar',
): Promise<RequireCcoOk | RequireCcoFail> {
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
  const soloLectura = actorEsSoloVistaEmpresa(actor.rolesEmpresa);

  if (modo === 'editar' && soloLectura) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Usuario de solo lectura: no puede modificar el CCO.',
          permiso_requerido: 'cco.editar' satisfies Permiso,
          roles_empresa: actor.rolesEmpresa,
        },
        { status: 403 },
      ),
    };
  }

  if (permisosEnforcementActivo()) {
    const need: Permiso = modo === 'editar' ? 'cco.editar' : 'cco.ver';
    const ok =
      actorTienePermiso(actor, need) ||
      (modo === 'ver' && actorTienePermiso(actor, 'cco.editar'));
    if (!ok) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'No tiene permiso para esta acción en CCO',
            permiso_requerido: need,
            roles_empresa: actor.rolesEmpresa,
          },
          { status: 403 },
        ),
      };
    }
  }

  return {
    ok: true,
    actor,
    supabase,
    userId: user.id,
    soloLectura,
  };
}
