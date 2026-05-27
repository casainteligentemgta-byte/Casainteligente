import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  crearTokenVinculoTelegramEmpleado,
  guardarIngenieroResidenteManual,
  obtenerIngenieroResidenteProyecto,
} from '@/lib/campo/ingenieroResidente';
import { buildTelegramDeepLink, getTelegramBotUsername } from '@/lib/campo/perfilesCampo';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import type { EquipoAlertasPayload, IngenieroResidenteManualInput } from '@/types/campo';

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

  const ingenieroAsignado = await obtenerIngenieroResidenteProyecto(supabase, proyectoId);

  const payload: EquipoAlertasPayload = {
    proyectoId,
    proyectoNombre: String(proy.nombre ?? 'Proyecto'),
    ingenieroAsignado,
    botUsername: getTelegramBotUsername(),
    fuente: 'manual',
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

  const body = (await req.json()) as {
    manual?: IngenieroResidenteManualInput | null;
    limpiar?: boolean;
  };
  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  try {
    const manual =
      body.limpiar || body.manual === null
        ? null
        : body.manual
          ? {
              nombres: String(body.manual.nombres ?? ''),
              primerApellido: String(body.manual.primerApellido ?? ''),
              segundoApellido: body.manual.segundoApellido
                ? String(body.manual.segundoApellido)
                : undefined,
              cedula: String(body.manual.cedula ?? ''),
            }
          : null;

    if (!body.limpiar && body.manual !== null && body.manual === undefined) {
      return NextResponse.json(
        { error: 'Envíe los datos del ingeniero (manual) o limpiar: true.' },
        { status: 400 },
      );
    }

    const ingenieroAsignado = await guardarIngenieroResidenteManual(
      supabase,
      proyectoId,
      manual,
    );
    return NextResponse.json({ ok: true, ingenieroAsignado });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo guardar';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
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
      { error: 'Registre el ingeniero residente (nombre, apellidos y cédula) antes de generar el enlace.' },
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
