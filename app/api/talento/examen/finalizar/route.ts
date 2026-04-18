import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST: cierra la prueba por token (p. ej. tiempo agotado): fin_at, respuestas_json, completado.
 * Requiere SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: {
    token?: string;
    respuestas_personalidad?: Record<string, number>;
    respuestas_logica?: Record<string, number>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 });
  }

  const respuestas_json = {
    respuestas_personalidad: body.respuestas_personalidad ?? {},
    respuestas_logica: body.respuestas_logica ?? {},
    cerrado_en: new Date().toISOString(),
  };

  const { data: row, error: selErr } = await admin.client
    .from('ci_examenes')
    .select('id, completado')
    .eq('token', token)
    .maybeSingle();

  if (selErr) {
    console.error('[finalizar]', selErr);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  const r = row as { id: string; completado: boolean };
  if (r.completado) {
    return NextResponse.json({ error: 'La evaluación ya fue cerrada' }, { status: 409 });
  }

  const finAt = new Date().toISOString();
  const { error: upErr } = await admin.client
    .from('ci_examenes')
    .update({
      fin_at: finAt,
      respuestas_json,
      completado: true,
    } as never)
    .eq('token', token)
    .eq('completado', false);

  if (upErr) {
    console.error('[finalizar] update', upErr);
    return NextResponse.json(
      { error: upErr.message, hint: '¿Migración 030 (fin_at, respuestas_json, completado)?' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    fin_at: finAt,
    mensaje: 'Tiempo agotado. Tu evaluación parcial quedó registrada en la invitación.',
  });
}
