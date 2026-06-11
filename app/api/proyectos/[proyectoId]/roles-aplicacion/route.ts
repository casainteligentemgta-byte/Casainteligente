import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  guardarRolesAplicacionProyecto,
  listarRolesAplicacionProyecto,
  type GuardarRolAplicacionInput,
} from '@/lib/proyectos/proyectoRolesAplicacion';
import { SLUGS_ROLES_APLICACION } from '@/lib/proyectos/rolesAplicacionProyecto';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

async function supabaseAdmin() {
  return createSupabaseAdminOnlyClient() ?? (await createClient());
}

export async function GET(_req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  try {
    const supabase = await supabaseAdmin();
    const roles = await listarRolesAplicacionProyecto(supabase, proyectoId);
    return NextResponse.json({ ok: true, proyectoId, roles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudieron cargar los roles';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  let body: { roles?: GuardarRolAplicacionInput[] };
  try {
    body = (await req.json()) as { roles?: GuardarRolAplicacionInput[] };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const rolesIn = Array.isArray(body.roles) ? body.roles : [];
  const roles = rolesIn.filter((r) => SLUGS_ROLES_APLICACION.has(String(r.slug ?? '').trim()));

  try {
    const supabase = await supabaseAdmin();
    const guardados = await guardarRolesAplicacionProyecto(supabase, proyectoId, roles);
    return NextResponse.json({ ok: true, proyectoId, roles: guardados });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudieron guardar los roles';
    const status = msg.includes('Indica el nombre') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
