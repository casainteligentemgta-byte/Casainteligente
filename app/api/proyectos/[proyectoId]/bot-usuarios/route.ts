import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  crearUsuarioBotProyecto,
  listarUsuariosBotProyecto,
  type CrearUsuarioBotInput,
} from '@/lib/proyectos/proyectoBotUsuarios';
import { ROLES_APLICACION_PROYECTO } from '@/lib/proyectos/rolesAplicacionProyecto';
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
    const usuarios = await listarUsuariosBotProyecto(supabase, proyectoId);
    return NextResponse.json({
      ok: true,
      proyectoId,
      usuarios,
      roles: ROLES_APLICACION_PROYECTO.map((r) => ({ slug: r.slug, label: r.label })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudieron cargar los usuarios del bot';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  let body: CrearUsuarioBotInput;
  try {
    body = (await req.json()) as CrearUsuarioBotInput;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    const supabase = await supabaseAdmin();
    const usuario = await crearUsuarioBotProyecto(supabase, proyectoId, body);
    return NextResponse.json({ ok: true, usuario });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo crear el usuario';
    const status = msg.includes('Indica') || msg.includes('obligatorio') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
