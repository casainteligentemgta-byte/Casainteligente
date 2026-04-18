import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import type { RolExamen } from '@/types/talento';

/**
 * POST: crea fila mínima en ci_empleados + ci_examenes con token TTL 15 min.
 * Requiere SUPABASE_SERVICE_ROLE_KEY (no uses la anon key aquí).
 * Opcional: TALENTO_GENERAR_LINK_SECRET → header Authorization: Bearer <secret>
 */
export async function POST(req: Request) {
  const secret = process.env.TALENTO_GENERAR_LINK_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (bearer !== secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
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
      { error: 'config', hint: 'Define NEXT_PUBLIC_BASE_URL (ej. https://tudominio.com) para el enlace del examen.' },
      { status: 503 },
    );
  }

  let body: {
    nombre?: string;
    whatsapp?: string;
    rol_examen?: RolExamen;
    rol_buscado?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nombre = (body.nombre ?? '').trim();
  const whatsapp = (body.whatsapp ?? '').trim();
  const rolExamen: RolExamen =
    body.rol_examen === 'programador' || body.rol_examen === 'tecnico' ? body.rol_examen : 'tecnico';
  const rolBuscado = (body.rol_buscado ?? '').trim() || 'Candidato (enlace de invitación)';

  if (!nombre) {
    return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
  }

  const supabase = admin.client;

  const token = randomUUID();
  const expiraAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { data: empleado, error: errEmp } = await supabase
    .from('ci_empleados')
    .insert({
      nombre_completo: nombre,
      telefono: whatsapp || null,
      rol_examen: rolExamen,
      rol_buscado: rolBuscado,
      respuestas_personalidad: {},
      respuestas_logica: {},
    } as never)
    .select('id')
    .single();

  if (errEmp || !empleado) {
    console.error('[talento generar-link] empleado', errEmp);
    return NextResponse.json(
      { error: errEmp?.message ?? 'No se pudo crear el empleado', hint: '¿Migración 029 (ci_examenes) y columnas 028?' },
      { status: 500 },
    );
  }

  const row = empleado as { id: string };

  const { error: errExa } = await supabase.from('ci_examenes').insert({
    empleado_id: row.id,
    token,
    expira_at: expiraAt,
  } as never);

  if (errExa) {
    console.error('[talento generar-link] examen', errExa);
    await supabase.from('ci_empleados').delete().eq('id', row.id);
    return NextResponse.json(
      { error: errExa.message, hint: 'Ejecuta supabase/migrations/029_ci_examenes_invite.sql' },
      { status: 500 },
    );
  }

  const examUrl = `${baseUrl}/talento/examen?token=${encodeURIComponent(token)}`;

  return NextResponse.json({
    url: examUrl,
    expira_at: expiraAt,
    empleado_id: row.id,
    token,
  });
}
