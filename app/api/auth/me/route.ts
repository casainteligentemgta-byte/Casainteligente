import { NextResponse } from 'next/server';
import { debeCambiarPassword } from '@/lib/auth/passwordPolicy';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — Sesión actual + flag de cambio de clave obligatorio. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    usuario: {
      id: user.id,
      email: user.email,
    },
    must_change_password: debeCambiarPassword(
      user.app_metadata as Record<string, unknown> | undefined,
    ),
  });
}
