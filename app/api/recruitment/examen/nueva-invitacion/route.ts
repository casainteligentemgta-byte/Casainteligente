import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ceoSecretConfigured,
  recruitmentAllowSupabaseUser,
  recruitmentCeoCookieName,
  verifyRecruitmentCeoAuthorized,
} from '@/lib/recruitment/ceo-auth';
import { hasSupabaseCeoSession } from '@/lib/recruitment/ceo-auth-server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST: nueva invitación (token 15 min) para un empleado existente — «2da oportunidad».
 * Body: { empleadoId: uuid }
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const authorized = verifyRecruitmentCeoAuthorized({
    req,
    cookieVal: cookieStore.get(recruitmentCeoCookieName())?.value,
    hasSupabaseUser: await hasSupabaseCeoSession(),
  });

  if (!authorized && (ceoSecretConfigured() || recruitmentAllowSupabaseUser())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { empleadoId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const empleadoId = (body.empleadoId ?? '').trim();
  if (!empleadoId) {
    return NextResponse.json({ error: 'empleadoId requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'config', hint: 'Define NEXT_PUBLIC_BASE_URL para el enlace del examen.' },
      { status: 503 },
    );
  }

  const { data: emp, error: errEmp } = await admin.client
    .from('ci_empleados')
    .select('id')
    .eq('id', empleadoId)
    .maybeSingle();

  if (errEmp || !emp) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const token = randomUUID();
  const expiraAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: errExa } = await admin.client.from('ci_examenes').insert({
    empleado_id: empleadoId,
    token,
    expira_at: expiraAt,
  } as never);

  if (errExa) {
    console.error('[nueva-invitacion]', errExa);
    return NextResponse.json({ error: errExa.message }, { status: 422 });
  }

  const url = `${baseUrl}/talento/examen?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ url, expira_at: expiraAt, token });
}
