import { NextResponse } from 'next/server';
import { evaluarObreroPorToken } from '@/lib/talento/evaluarObreroPorToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/** @deprecated Preferir POST `/api/talento/examen/evaluar` con `{ token, respuestas, rol }`. */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { token?: string; rol?: string; respuestas?: Record<string, string> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const out = await evaluarObreroPorToken(admin.client, {
    token: body.token ?? '',
    rol: body.rol ?? '',
    respuestas: body.respuestas ?? {},
  });

  if ('error' in out) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json(out);
}
