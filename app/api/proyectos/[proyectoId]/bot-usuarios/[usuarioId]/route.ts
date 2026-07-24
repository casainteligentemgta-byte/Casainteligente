import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  actualizarUsuarioBotProyecto,
  eliminarUsuarioBotProyecto,
  type ActualizarUsuarioBotInput,
} from '@/lib/proyectos/proyectoBotUsuarios';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string; usuarioId: string } };

async function supabaseAdmin() {
  return createSupabaseAdminOnlyClient() ?? (await createClient());
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  const usuarioId = params.usuarioId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }
  if (!usuarioId) {
    return NextResponse.json({ error: 'usuarioId requerido' }, { status: 400 });
  }

  let body: ActualizarUsuarioBotInput;
  try {
    body = (await req.json()) as ActualizarUsuarioBotInput;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    const supabase = await supabaseAdmin();
    const usuario = await actualizarUsuarioBotProyecto(supabase, proyectoId, usuarioId, body);
    return NextResponse.json({ ok: true, usuario });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo actualizar el usuario';
    const status =
      msg.includes('no encontrado') || msg.includes('Indica') || msg.includes('vacío') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  const usuarioId = params.usuarioId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }
  if (!usuarioId) {
    return NextResponse.json({ error: 'usuarioId requerido' }, { status: 400 });
  }

  try {
    const supabase = await supabaseAdmin();
    await eliminarUsuarioBotProyecto(supabase, proyectoId, usuarioId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar el usuario';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
