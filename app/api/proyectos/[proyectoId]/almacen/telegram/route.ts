import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  actualizarGrupoTelegramAlmacenProyecto,
  crearTokenVinculoTelegramEmpleado,
  guardarDepositarioObraManual,
  obtenerConfigTelegramAlmacenProyecto,
} from '@/lib/almacen/depositarioObra';
import { buildTelegramDeepLink, getTelegramBotUsername } from '@/lib/campo/perfilesCampo';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import type { IngenieroResidenteManualInput } from '@/types/campo';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

export async function GET(_req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
  const config = await obtenerConfigTelegramAlmacenProyecto(supabase, proyectoId);
  if (!config) {
    return NextResponse.json(
      {
        error:
          'Enrutamiento almacén no disponible. Aplique la migración 201_telegram_enrutamiento_almacen.sql.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ...config,
    botUsername: getTelegramBotUsername(),
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  const body = (await req.json()) as {
    manual?: IngenieroResidenteManualInput | null;
    limpiar?: boolean;
    telegramGrupoAlmacenId?: string | number | null;
  };

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  try {
    let depositarioAsignado = null;

    if (body.limpiar || body.manual === null) {
      depositarioAsignado = await guardarDepositarioObraManual(supabase, proyectoId, null);
    } else if (body.manual) {
      depositarioAsignado = await guardarDepositarioObraManual(supabase, proyectoId, {
        nombres: String(body.manual.nombres ?? ''),
        primerApellido: String(body.manual.primerApellido ?? ''),
        segundoApellido: body.manual.segundoApellido
          ? String(body.manual.segundoApellido)
          : undefined,
        cedula: String(body.manual.cedula ?? ''),
      });
    }

    if (body.telegramGrupoAlmacenId !== undefined) {
      const raw = body.telegramGrupoAlmacenId;
      const grupoId =
        raw === null || raw === ''
          ? null
          : Number(String(raw).trim());
      if (grupoId !== null && !Number.isFinite(grupoId)) {
        return NextResponse.json({ error: 'Chat ID de grupo inválido.' }, { status: 400 });
      }
      await actualizarGrupoTelegramAlmacenProyecto(supabase, proyectoId, grupoId);
    }

    const config = await obtenerConfigTelegramAlmacenProyecto(supabase, proyectoId);
    return NextResponse.json({
      ok: true,
      depositarioAsignado: depositarioAsignado ?? config?.depositarioAsignado ?? null,
      telegramGrupoAlmacenId: config?.telegramGrupoAlmacenId ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo guardar';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  const body = (await req.json()) as { empleadoId?: string };
  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  const config = await obtenerConfigTelegramAlmacenProyecto(supabase, proyectoId);
  const empleadoId = body.empleadoId?.trim() || config?.depositarioAsignado?.id;
  if (!empleadoId) {
    return NextResponse.json(
      { error: 'Registre al depositario (nombre, apellidos y cédula) antes de generar el enlace.' },
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
