import { NextResponse } from 'next/server';
import {
  debeCambiarPassword,
  MUST_CHANGE_PASSWORD_KEY,
  validarNuevaPassword,
} from '@/lib/auth/passwordPolicy';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  password?: string;
};

/**
 * POST — El usuario en sesión define su nueva clave y limpia must_change_password.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const invalid = validarNuevaPassword(password);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createSupabaseAdminOnlyClient();
  if (admin) {
    const nextMeta = {
      ...(user.app_metadata ?? {}),
      [MUST_CHANGE_PASSWORD_KEY]: false,
    };
    await admin.auth.admin.updateUserById(user.id, { app_metadata: nextMeta });
  } else if (debeCambiarPassword(user.app_metadata as Record<string, unknown>)) {
    return NextResponse.json(
      {
        error:
          'Clave actualizada, pero no se pudo limpiar el flag obligatorio (falta SERVICE_ROLE). Contacte a un administrador.',
        code: 'SUPABASE_ADMIN_CONFIG',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, message: 'Clave actualizada correctamente' });
}
