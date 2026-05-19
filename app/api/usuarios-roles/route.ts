import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buscarUsuarioIdPorEmail } from '@/lib/auth/buscarUsuarioIdPorEmail';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  email?: string;
  rol?: string;
  entidadId?: string;
  entidad_id?: string;
};

/**
 * POST { email, rol, entidadId }
 * 1) Resuelve usuario_id en Auth por email (service role).
 * 2) Inserta/actualiza en ci_usuarios_roles con createClient() (sesión authenticated).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const rol = (body.rol ?? '').trim();
  const entidadId = (body.entidadId ?? body.entidad_id ?? '').trim();

  if (!email) {
    return NextResponse.json({ error: 'email requerido' }, { status: 400 });
  }
  if (!rol) {
    return NextResponse.json({ error: 'rol requerido' }, { status: 400 });
  }
  if (!entidadId || !UUID_RE.test(entidadId)) {
    return NextResponse.json({ error: 'entidadId inválido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const authLookup = await buscarUsuarioIdPorEmail(admin.client, email);
  if ('error' in authLookup) {
    const status = authLookup.error.includes('no encontrado') ? 404 : 502;
    return NextResponse.json({ error: authLookup.error }, { status });
  }

  const { data: entidad, error: entErr } = await supabase
    .from('ci_entidades')
    .select('id')
    .eq('id', entidadId)
    .maybeSingle();

  if (entErr) {
    return NextResponse.json({ error: entErr.message }, { status: 500 });
  }
  if (!entidad) {
    return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 });
  }

  const row = {
    usuario_id: authLookup.userId,
    rol,
    entidad_id: entidadId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ci_usuarios_roles')
    .upsert(row, { onConflict: 'usuario_id,entidad_id' })
    .select('id, usuario_id, rol, entidad_id, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, hint: error.hint }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    usuario_id: authLookup.userId,
    email: email.trim().toLowerCase(),
    registro: data,
  });
}
