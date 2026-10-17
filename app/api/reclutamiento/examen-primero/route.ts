import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * PATCH { recruitment_need_id, examen_primero } — RRHH elige el orden del enlace de captación:
 * true = datos básicos → evaluación → hoja de vida; false = hoja de vida → evaluación.
 */
export async function PATCH(req: Request) {
  const acceso = await requireAlgunPermisoWeb(['equipo.gestionar']);
  if (!acceso.ok) return acceso.response;

  let body: { recruitment_need_id?: string; examen_primero?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const needId = (body.recruitment_need_id ?? '').trim();
  if (!needId) {
    return NextResponse.json({ error: 'recruitment_need_id requerido' }, { status: 400 });
  }
  if (typeof body.examen_primero !== 'boolean') {
    return NextResponse.json({ error: 'examen_primero debe ser true o false' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.client
    .from('recruitment_needs')
    .update({ examen_primero: body.examen_primero } as never)
    .eq('id', needId)
    .select('id, examen_primero')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: (error.message ?? '').includes('examen_primero')
          ? 'Ejecuta la migración 361_recruitment_needs_examen_primero.sql en Supabase.'
          : undefined,
      },
      { status: 500 },
    );
  }
  if (!data) return NextResponse.json({ error: 'Vacante no encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true, ...(data as { id: string; examen_primero: boolean }) });
}
