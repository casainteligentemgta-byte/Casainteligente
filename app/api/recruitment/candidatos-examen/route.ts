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

type Row = {
  id: string;
  token: string;
  expira_at: string;
  usado_at: string | null;
  completado: boolean;
  created_at: string;
  empleado_id: string;
  ci_empleados: { nombre_completo: string; rol_buscado: string | null } | null;
};

/**
 * GET: invitaciones a examen pendientes (no completadas) para el monitor CEO.
 * Requiere misma autenticación que el dashboard (cookie CEO, Supabase user o clave pública si no hay puerta).
 */
export async function GET(req: Request) {
  const cookieStore = cookies();
  const authorized = verifyRecruitmentCeoAuthorized({
    req,
    cookieVal: cookieStore.get(recruitmentCeoCookieName())?.value,
    hasSupabaseUser: await hasSupabaseCeoSession(),
  });

  if (!authorized && (ceoSecretConfigured() || recruitmentAllowSupabaseUser())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) {
    return NextResponse.json({
      candidatos: [],
      hint: 'Configure SUPABASE_SERVICE_ROLE_KEY para listar invitaciones.',
    });
  }

  const { data, error } = await admin.client
    .from('ci_examenes')
    .select(
      'id, token, expira_at, usado_at, completado, created_at, empleado_id, ci_empleados(nombre_completo, rol_buscado)',
    )
    .eq('completado', false)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.error('[candidatos-examen]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];

  const candidatos = rows.map((r) => {
    const emp = r.ci_empleados;
    return {
      id: r.id,
      empleadoId: r.empleado_id,
      nombre: emp?.nombre_completo ?? '—',
      cargo: emp?.rol_buscado?.trim() || 'Sin cargo indicado',
      token: r.token,
      expiraAt: r.expira_at,
      creadoAt: r.created_at,
      usadoAt: r.usado_at,
    };
  });

  return NextResponse.json({ candidatos });
}
