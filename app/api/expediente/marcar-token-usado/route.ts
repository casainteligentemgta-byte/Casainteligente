import { NextResponse } from 'next/server';
import { marcarExpedienteTokenUsado } from '@/lib/reclutamiento/validarExpedienteToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

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

  await marcarExpedienteTokenUsado(admin.client, token);
  return NextResponse.json({ ok: true });
}
