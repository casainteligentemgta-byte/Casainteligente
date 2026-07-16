import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buscarUsuarioIdPorEmail } from '@/lib/auth/buscarUsuarioIdPorEmail';
import { upsertRolEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
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
 * Asigna rol a un usuario que ya existe en Auth.
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
    return NextResponse.json(
      {
        error: authLookup.error,
        hint: 'Use «Invitar usuario» para enviar el correo de acceso, o créelo antes en Supabase Auth.',
      },
      { status },
    );
  }

  const supabase = await createClient();
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

  const { data, error } = await upsertRolEmpresaUsuario(admin.client, {
    userId: authLookup.userId,
    rol,
    entidadId,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    usuario_id: authLookup.userId,
    email: email.trim().toLowerCase(),
    registro: data,
  });
}
