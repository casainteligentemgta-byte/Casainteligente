import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import {
  parseRolComprasTelegram,
  parseTelegramIdNumerico,
} from '@/lib/compras/usuariosSistemaTelegram';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteCtx = { params: { id: string } };

async function authGestionarComprasTelegram() {
  const equipo = await requirePermisoWeb('equipo.gestionar');
  if (equipo.ok) return equipo;
  return requirePermisoWeb('admin.config');
}

/** PATCH — Actualizar nombre, rol, telegram_id, activo. */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await authGestionarComprasTelegram();
  if (!auth.ok) return auth.response;

  const id = params.id?.trim() ?? '';
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const body = (await req.json()) as {
    nombre?: string;
    telegram_id?: string | number;
    rol?: string;
    activo?: boolean;
    proyecto_id?: string | null;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
    patch.nombre = nombre.slice(0, 150);
  }
  if (body.telegram_id !== undefined) {
    const tid = parseTelegramIdNumerico(body.telegram_id);
    if (tid == null) return NextResponse.json({ error: 'telegram_id inválido' }, { status: 400 });
    patch.telegram_id = tid;
  }
  if (body.rol !== undefined) {
    const rol = parseRolComprasTelegram(body.rol);
    if (!rol) return NextResponse.json({ error: 'rol inválido' }, { status: 400 });
    patch.rol = rol;
  }
  if (body.activo !== undefined) patch.activo = Boolean(body.activo);
  if (body.proyecto_id !== undefined) {
    patch.proyecto_id = body.proyecto_id?.trim() || null;
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.client
    .from('ci_usuarios_sistema_telegram')
    .update(patch as never)
    .eq('id', id)
    .select('id, nombre, telegram_id, rol, proyecto_id, activo')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, usuario: data });
}

/** DELETE — Baja del departamento compras (elimina fila). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await authGestionarComprasTelegram();
  if (!auth.ok) return auth.response;

  const id = params.id?.trim() ?? '';
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { error } = await admin.client.from('ci_usuarios_sistema_telegram').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
