import { NextResponse } from 'next/server';
import { contratoObreroPorToken } from '@/lib/talento/contratoObreroToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * POST { contrato_id, token } — Registra aceptación electrónica del contrato por el obrero.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { contrato_id?: string; token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const contratoId = (body.contrato_id ?? '').trim();
  const token = (body.token ?? '').trim();
  if (!contratoId || !token) {
    return NextResponse.json({ error: 'contrato_id y token requeridos' }, { status: 400 });
  }

  const v = await contratoObreroPorToken(admin.client, contratoId, token);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  if (v.obreroAceptacionContratoAt) {
    return NextResponse.json({
      ok: true,
      ya_aceptado: true,
      obrero_aceptacion_contrato_at: v.obreroAceptacionContratoAt,
    });
  }

  const ahora = new Date().toISOString();
  const { error: up } = await admin.client
    .from('ci_contratos_empleado_obra')
    .update({ obrero_aceptacion_contrato_at: ahora } as never)
    .eq('id', v.contratoId);

  if (up) {
    console.error('[contrato-laboral aceptar]', up);
    return NextResponse.json(
      {
        error: up.message,
        hint:
          'Si el error menciona una columna desconocida, ejecuta en Supabase supabase/migrations/083_ci_contratos_obrero_aceptacion_impresion.sql',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, obrero_aceptacion_contrato_at: ahora });
}
