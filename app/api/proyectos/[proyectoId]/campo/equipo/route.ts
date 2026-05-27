import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  asignarIngenieroResidenteProyecto,
  crearTokenVinculoTelegramEmpleado,
  listarEmpleadosElegiblesObra,
  obtenerIngenieroResidenteProyecto,
} from '@/lib/campo/ingenieroResidente';
import { buildTelegramDeepLink, getTelegramBotUsername } from '@/lib/campo/perfilesCampo';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import type { EquipoAlertasPayload } from '@/types/campo';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

export async function GET(_req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  const { data: proy, error: pErr } = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .eq('id', proyectoId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!proy) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  const [ingenieroAsignado, empleadosDisponibles] = await Promise.all([
    obtenerIngenieroResidenteProyecto(supabase, proyectoId),
    listarEmpleadosElegiblesObra(supabase, proyectoId),
  ]);

  const payload: EquipoAlertasPayload = {
    proyectoId,
    proyectoNombre: String(proy.nombre ?? 'Proyecto'),
    ingenieroAsignado,
    empleadosDisponibles,
    botUsername: getTelegramBotUsername(),
    fuente: 'rrhh',
  };

  return NextResponse.json(payload);
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  const body = (await req.json()) as { empleadoId?: string | null };
  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  await asignarIngenieroResidenteProyecto(
    supabase,
    proyectoId,
    body.empleadoId?.trim() || null,
  );

  const ingenieroAsignado = body.empleadoId
    ? await obtenerIngenieroResidenteProyecto(supabase, proyectoId)
    : null;

  return NextResponse.json({ ok: true, ingenieroAsignado });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  const body = (await req.json()) as { empleadoId?: string };
  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  const ingeniero = await obtenerIngenieroResidenteProyecto(supabase, proyectoId);
  const empleadoId = body.empleadoId?.trim() || ingeniero?.id;
  if (!empleadoId) {
    return NextResponse.json(
      { error: 'Asigne un ingeniero residente en RRHH antes de generar el enlace.' },
      { status: 400 },
    );
  }

  const botUsername = getTelegramBotUsername();
  if (!botUsername) {
    return NextResponse.json(
      {
        error:
          'Configura TELEGRAM_BOT_USERNAME en Vercel (sin @) para generar enlaces de sincronización.',
      },
      { status: 503 },
    );
  }

  const { token, expiresAt } = await crearTokenVinculoTelegramEmpleado(supabase, empleadoId);
  const deepLink = buildTelegramDeepLink(botUsername, token);

  return NextResponse.json({ token, expiresAt, deepLink, botUsername, empleadoId });
}
