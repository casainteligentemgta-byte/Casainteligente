import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import {
  parseRolComprasTelegram,
  parseTelegramIdNumerico,
} from '@/lib/compras/usuariosSistemaTelegram';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

async function authGestionarComprasTelegram() {
  const equipo = await requirePermisoWeb('equipo.gestionar');
  if (equipo.ok) return equipo;
  return requirePermisoWeb('admin.config');
}

/** GET — Usuarios Telegram del departamento de compras. */
export async function GET() {
  const auth = await authGestionarComprasTelegram();
  if (!auth.ok) return auth.response;

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.client
    .from('ci_usuarios_sistema_telegram')
    .select('id, nombre, telegram_id, rol, proyecto_id, activo, created_at, updated_at')
    .order('nombre');

  if (error?.code === '42P01') {
    return NextResponse.json({
      ok: true,
      usuarios: [],
      hint: 'Ejecute migración 230_ci_compras_departamento_telegram.sql',
    });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, usuarios: data ?? [] });
}

/** POST — Alta / upsert por telegram_id. */
export async function POST(req: Request) {
  const auth = await authGestionarComprasTelegram();
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as {
    nombre?: string;
    telegram_id?: string | number;
    rol?: string;
    proyecto_id?: string | null;
    activo?: boolean;
  };

  const nombre = body.nombre?.trim();
  const telegramId = parseTelegramIdNumerico(body.telegram_id ?? '');
  const rol = parseRolComprasTelegram(body.rol);

  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
  if (telegramId == null) return NextResponse.json({ error: 'telegram_id inválido' }, { status: 400 });
  if (!rol) return NextResponse.json({ error: 'rol inválido' }, { status: 400 });

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const row = {
    nombre: nombre.slice(0, 150),
    telegram_id: telegramId,
    rol,
    proyecto_id: body.proyecto_id?.trim() || null,
    activo: body.activo !== false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin.client
    .from('ci_usuarios_sistema_telegram')
    .upsert(row as never, { onConflict: 'telegram_id' })
    .select('id, nombre, telegram_id, rol, proyecto_id, activo')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, usuario: data });
}
