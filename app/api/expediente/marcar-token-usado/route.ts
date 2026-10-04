import { NextResponse } from 'next/server';
import { marcarExpedienteTokenUsado } from '@/lib/reclutamiento/validarExpedienteToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { avisarRegistroObreroTelegram } from '@/lib/rrhh/avisoRegistroObreroTelegram';

export const runtime = 'nodejs';

/** POST { token } — Marca el enlace de expediente como utilizado. */
export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  // Enlace personal: si el token aún no estaba usado, el obrero acaba de completar su hoja de vida.
  const { data: pendiente } = await admin.client
    .from('expediente_tokens')
    .select('hoja_vida_id')
    .eq('token', token)
    .eq('is_used', false)
    .maybeSingle();

  await marcarExpedienteTokenUsado(admin.client, token);

  const empleadoId = String((pendiente as { hoja_vida_id?: string } | null)?.hoja_vida_id ?? '').trim();
  if (empleadoId) {
    let base = '';
    try {
      base = (request.headers.get('origin') ?? new URL(request.url).origin).replace(/\/$/, '');
    } catch {
      base = '';
    }
    await avisarRegistroObreroTelegram(admin.client, empleadoId, base);
  }
  return NextResponse.json({ ok: true });
}
