import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notificarPermisologiaTelegram } from '@/lib/legal/notificarPermisologiaTelegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST — tras guardar permisología de un patrono, dispara alerta Telegram
 * al Departamento Legal si hay vencimientos ≤ 30 días.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const entidadId = String(body.entidadId ?? '').trim();
  if (!entidadId) {
    return NextResponse.json({ error: 'entidadId requerido' }, { status: 400 });
  }

  try {
    const result = await notificarPermisologiaTelegram({ entidadId });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al notificar';
    console.error('[permisologia/notificar]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
