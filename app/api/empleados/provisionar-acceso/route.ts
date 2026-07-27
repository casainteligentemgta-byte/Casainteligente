import { NextResponse } from 'next/server';
import { provisionarAccesoEmpleado, type ProvisionMode } from '@/lib/auth/provisionEmployee';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  employeeId?: string;
  email?: string;
  nombres?: string;
  apellidos?: string;
  /** invite (default) | password */
  mode?: ProvisionMode | string;
  rol?: string | null;
  entidadId?: string | null;
  entidad_id?: string | null;
};

/**
 * POST — Habilita acceso web del empleado CRM.
 * Preferir mode=invite; mode=password genera clave aleatoria de un solo uso.
 */
export async function POST(req: Request) {
  const gate = await requirePermisoWeb('equipo.gestionar');
  if (!gate.ok) return gate.response;

  const admin = createSupabaseAdminOnlyClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Configúrala en Vercel y vuelve a desplegar.',
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

  let email = (body.email ?? '').trim().toLowerCase();
  let nombres = body.nombres;
  let apellidos = body.apellidos;
  const employeeId = (body.employeeId ?? '').trim() || undefined;

  if (employeeId) {
    const { data: emp, error } = await admin
      .from('employees')
      .select('id, email, nombres, apellidos, auth_user_id, acceso_habilitado')
      .eq('id', employeeId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    if (!email) email = String((emp as { email?: string }).email ?? '').trim().toLowerCase();
    if (!nombres) nombres = (emp as { nombres?: string }).nombres;
    if (!apellidos) apellidos = (emp as { apellidos?: string }).apellidos;
  }

  if (!email) {
    return NextResponse.json(
      { error: 'El empleado necesita un correo para habilitar el acceso' },
      { status: 400 },
    );
  }

  const mode: ProvisionMode = body.mode === 'password' ? 'password' : 'invite';
  const result = await provisionarAccesoEmpleado(admin, {
    email,
    employeeId,
    nombres,
    apellidos,
    mode,
    rol: body.rol,
    entidadId: body.entidadId ?? body.entidad_id,
    request: req,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let mensaje: string;
  if (result.mode === 'invite' && result.inviteEnviado) {
    mensaje =
      'Invitación enviada por correo. El empleado definirá su propia clave al aceptar.';
  } else if (result.mode === 'invite') {
    mensaje =
      'Acceso vinculado a una cuenta existente (sin cambiar la clave actual).';
  } else if (result.oneTimePassword) {
    mensaje =
      'Acceso habilitado con clave de un solo uso. Entrégala al empleado por un canal seguro; deberá cambiarla al entrar.';
  } else {
    mensaje = 'Acceso configurado.';
  }

  return NextResponse.json(
    {
      ok: true,
      userId: result.userId,
      created: result.created,
      email: result.email,
      mode: result.mode,
      invite_enviado: result.inviteEnviado,
      /** Solo en modo password — no se vuelve a mostrar. */
      one_time_password: result.oneTimePassword ?? null,
      message: mensaje,
    },
    { status: 201 },
  );
}
