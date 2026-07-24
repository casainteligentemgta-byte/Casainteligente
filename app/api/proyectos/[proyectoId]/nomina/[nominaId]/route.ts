import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  actualizarFilaNominaProyecto,
  eliminarFilaNominaProyecto,
  type ActualizarNominaProyectoInput,
} from '@/lib/proyectos/proyectoNomina';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteCtx = { params: { proyectoId: string; nominaId: string } };

async function supabaseParaNomina() {
  return createSupabaseAdminOnlyClient() ?? (await createClient());
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  const nominaId = params.nominaId?.trim() ?? '';

  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }
  if (!UUID_RE.test(nominaId)) {
    return NextResponse.json({ error: 'nominaId inválido' }, { status: 400 });
  }

  let body: ActualizarNominaProyectoInput;
  try {
    body = (await req.json()) as ActualizarNominaProyectoInput;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const supabase = await supabaseParaNomina();

  try {
    const fila = await actualizarFilaNominaProyecto(supabase, proyectoId, nominaId, body);
    return NextResponse.json({ ok: true, fila });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo actualizar';
    const status =
      msg.includes('no encontrado') || msg.includes('vacío') || msg.includes('inválida')
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  const nominaId = params.nominaId?.trim() ?? '';

  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }
  if (!UUID_RE.test(nominaId)) {
    return NextResponse.json({ error: 'nominaId inválido' }, { status: 400 });
  }

  const supabase = await supabaseParaNomina();

  try {
    await eliminarFilaNominaProyecto(supabase, proyectoId, nominaId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
