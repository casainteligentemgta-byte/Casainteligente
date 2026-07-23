import { NextResponse } from 'next/server';
import { buscarUsuarioIdPorEmail } from '@/lib/auth/buscarUsuarioIdPorEmail';
import { upsertRolEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { normalizarRolEmpresa } from '@/lib/auth/permisosCatalogo';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  crearTelegramWhitelist,
  parseTelegramChatIdInput,
} from '@/lib/telegram/chatWhitelist';
import { rolSistemaTelegramDesdeSlugApp } from '@/lib/procuras/aprobadoresProcuraTelegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  email?: string;
  nombre?: string;
  rol?: string;
  entidadId?: string;
  entidad_id?: string;
  /** Si true (default), envía invite de Supabase Auth cuando el usuario aún no existe. */
  invitar_web?: boolean;
  /**
   * Si se envía (≥ 8 chars) y el usuario no existe, crea cuenta con esa clave
   * (sin correo de invitación). Útil p. ej. acceso CCO solo lectura.
   */
  password?: string | null;
  /** Chat ID numérico de Telegram (whitelist del bot). */
  telegram_chat_id?: string | number | null;
  cargo?: string | null;
};

function baseUrlApp(req: Request): string {
  const env =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    '';
  if (env) return env.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return 'https://casainteligente.company';
}

/**
 * POST — Invita usuario por correo (Auth), asigna rol por entidad y opcionalmente
 * lo agrega a la whitelist de Telegram.
 *
 * Body: { email, nombre?, rol, entidadId, invitar_web?, telegram_chat_id?, cargo? }
 */
export async function POST(req: Request) {
  const gate = await requirePermisoWeb('equipo.gestionar');
  if (!gate.ok) return gate.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const nombre = (body.nombre ?? '').trim() || email.split('@')[0] || 'Usuario';
  const rolRaw = (body.rol ?? '').trim();
  const entidadId = (body.entidadId ?? body.entidad_id ?? '').trim();
  const invitarWeb = body.invitar_web !== false;
  const password = typeof body.password === 'string' ? body.password : '';
  const crearConPassword = password.length > 0;
  const chatIdRaw = body.telegram_chat_id;
  const cargo = body.cargo?.trim() || null;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email inválido' }, { status: 400 });
  }
  if (crearConPassword && password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres' },
      { status: 400 },
    );
  }
  const rolNorm = normalizarRolEmpresa(rolRaw);
  if (!rolNorm) {
    return NextResponse.json({ error: 'rol inválido' }, { status: 400 });
  }
  if (!entidadId || !UUID_RE.test(entidadId)) {
    return NextResponse.json({ error: 'entidadId inválido' }, { status: 400 });
  }

  const admin = createSupabaseAdminOnlyClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'Falta SUPABASE_SERVICE_ROLE_KEY para invitar usuarios' },
      { status: 503 },
    );
  }

  const { data: entidad, error: entErr } = await admin
    .from('ci_entidades')
    .select('id,nombre')
    .eq('id', entidadId)
    .maybeSingle();
  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 });
  if (!entidad) return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 });

  let userId: string | null = null;
  let inviteEnviado = false;
  let yaExistia = false;
  let creadoConPassword = false;

  const lookup = await buscarUsuarioIdPorEmail(admin, email);
  if ('userId' in lookup) {
    userId = lookup.userId;
    yaExistia = true;
    if (crearConPassword) {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { nombre, entidad_id: entidadId, rol: rolNorm },
      });
      if (updErr) {
        return NextResponse.json(
          { error: updErr.message || 'No se pudo actualizar la contraseña' },
          { status: 502 },
        );
      }
      creadoConPassword = true;
    }
  } else if (crearConPassword) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, entidad_id: entidadId, rol: rolNorm },
    });
    if (createErr) {
      return NextResponse.json(
        { error: createErr.message || 'No se pudo crear el usuario' },
        { status: 502 },
      );
    }
    userId = created.user?.id ?? null;
    creadoConPassword = Boolean(userId);
  } else if (invitarWeb) {
    const home =
      rolNorm === 'cco_lectura'
        ? '/contabilidad/cco'
        : '/';
    const redirectTo = `${baseUrlApp(req)}/auth/callback?next=${encodeURIComponent(home)}`;
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { nombre, entidad_id: entidadId, rol: rolNorm },
    });
    if (inviteErr) {
      // Usuario puede existir pero listUsers no lo encontró; reintentar lookup
      const again = await buscarUsuarioIdPorEmail(admin, email);
      if ('userId' in again) {
        userId = again.userId;
        yaExistia = true;
      } else {
        return NextResponse.json(
          { error: inviteErr.message || 'No se pudo enviar la invitación' },
          { status: 502 },
        );
      }
    } else {
      userId = inviteData.user?.id ?? null;
      inviteEnviado = Boolean(userId);
      if (!userId) {
        const again = await buscarUsuarioIdPorEmail(admin, email);
        if ('userId' in again) userId = again.userId;
      }
    }
  } else {
    return NextResponse.json(
      {
        error: 'Usuario no encontrado en Auth. Active invitar_web, envíe password o créelo antes.',
      },
      { status: 404 },
    );
  }

  if (!userId) {
    return NextResponse.json({ error: 'No se obtuvo el id del usuario Auth' }, { status: 502 });
  }

  const { data: rolRow, error: rolErr } = await upsertRolEmpresaUsuario(admin, {
    userId,
    rol: rolNorm,
    entidadId,
  });
  if (rolErr) {
    return NextResponse.json({ error: rolErr }, { status: 500 });
  }

  let telegram: { whitelist: boolean; sistema: boolean; chat_id?: number } | null = null;
  const chatId = parseTelegramChatIdInput(chatIdRaw ?? null);
  if (chatId != null) {
    try {
      await crearTelegramWhitelist(admin, {
        nombre,
        chat_id: chatId,
        email,
        cargo: cargo ?? rolNorm,
        notas: `Invitado desde Equipo · ${String((entidad as { nombre?: string }).nombre ?? entidadId)}`,
      });
      telegram = { whitelist: true, sistema: false, chat_id: chatId };

      const rolTg = rolSistemaTelegramDesdeSlugApp(rolNorm);
      if (rolTg) {
        const { error: sisErr } = await admin.from('ci_usuarios_sistema_telegram').upsert(
          {
            nombre: nombre.slice(0, 150),
            telegram_id: chatId,
            rol: rolTg,
            proyecto_id: null,
            activo: true,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'telegram_id' },
        );
        if (!sisErr || sisErr.code === '42P01') {
          telegram.sistema = !sisErr;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error Telegram';
      return NextResponse.json(
        {
          ok: true,
          warning: `Usuario creado/rol asignado, pero Telegram falló: ${msg}`,
          usuario_id: userId,
          email,
          invite_enviado: inviteEnviado,
          ya_existia: yaExistia,
          registro: rolRow,
        },
        { status: 201 },
      );
    }
  }

  let mensaje: string;
  if (creadoConPassword && !yaExistia) {
    mensaje =
      rolNorm === 'cco_lectura'
        ? 'Usuario CCO (solo visualización) creado con contraseña. Puede entrar en /login.'
        : 'Usuario creado con contraseña. Puede entrar en /login.';
  } else if (creadoConPassword && yaExistia) {
    mensaje = 'Usuario ya existía; se actualizó el rol y la contraseña.';
  } else if (inviteEnviado) {
    mensaje = 'Invitación enviada por correo. El usuario definirá su clave al aceptar.';
  } else if (yaExistia) {
    mensaje = 'Usuario ya existía en Auth; se actualizó el rol.';
  } else {
    mensaje = 'Acceso configurado.';
  }

  return NextResponse.json(
    {
      ok: true,
      usuario_id: userId,
      email,
      invite_enviado: inviteEnviado,
      creado_con_password: creadoConPassword,
      ya_existia: yaExistia,
      registro: rolRow,
      telegram,
      home:
        rolNorm === 'cco_lectura' ? '/contabilidad/cco' : '/',
      mensaje,
    },
    { status: 201 },
  );
}
