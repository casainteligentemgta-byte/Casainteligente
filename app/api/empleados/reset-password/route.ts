import { NextResponse } from 'next/server';
import { buscarUsuarioIdPorEmail } from '@/lib/auth/buscarUsuarioIdPorEmail';
import { resetPasswordEmpleado } from '@/lib/auth/provisionEmployee';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  employeeId?: string;
  email?: string;
  userId?: string;
};

/**
 * POST — Regenera clave aleatoria de un solo uso y fuerza cambio al entrar.
 * Requiere permiso equipo.gestionar (admin / RRHH; no contador).
 */
export async function POST(req: Request) {
  const gate = await requirePermisoWeb('equipo.gestionar');
  if (!gate.ok) return gate.response;

  const admin = createSupabaseAdminOnlyClient();
  if (!admin) {
    return NextResponse.json(
      {
        error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor',
        code: 'SUPABASE_ADMIN_CONFIG',
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  let targetUserId = (body.userId ?? '').trim();
  let email = (body.email ?? '').trim().toLowerCase();
  const employeeId = (body.employeeId ?? '').trim() || undefined;

  if (employeeId) {
    const { data: emp, error } = await admin
      .from('employees')
      .select('id, email, auth_user_id, nombres, apellidos')
      .eq('id', employeeId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    const row = emp as {
      email?: string | null;
      auth_user_id?: string | null;
    };
    if (!email) email = (row.email ?? '').trim().toLowerCase();
    if (!targetUserId) targetUserId = (row.auth_user_id ?? '').trim();
  }

  if (!targetUserId && email) {
    const lookup = await buscarUsuarioIdPorEmail(admin, email);
    if ('userId' in lookup) targetUserId = lookup.userId;
  }

  if (!targetUserId) {
    return NextResponse.json(
      {
        error:
          'Este empleado aún no tiene usuario Auth. Usa «Habilitar acceso» primero.',
      },
      { status: 404 },
    );
  }

  const result = await resetPasswordEmpleado(admin, {
    userId: targetUserId,
    employeeId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    userId: result.userId,
    email: result.email,
    one_time_password: result.oneTimePassword ?? null,
    message:
      'Clave regenerada. Entrégala al empleado por un canal seguro; deberá cambiarla al entrar.',
  });
}
