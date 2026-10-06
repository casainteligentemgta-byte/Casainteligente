import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { registrarAdelantoPrestaciones } from '@/lib/nomina/persistirSemanaObra';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const itemId = String(body.item_id ?? '').trim();
  const solicitud = String(body.solicitud_texto ?? '').trim();
  if (!itemId) return NextResponse.json({ error: 'Falta item_id del adelanto.' }, { status: 400 });

  const admin = supabaseAdminForRoute();
  const db = admin.ok ? admin.client : supabase;

  try {
    const r = await registrarAdelantoPrestaciones(db, {
      itemId,
      solicitudTexto:
        solicitud ||
        'Solicito adelanto de prestaciones sociales conforme al artículo 144 de la LOTTT, correspondiente a la quinta semana pactada cada cuatro semanas trabajadas.',
      firmanteNombre: body.firmante_nombre != null ? String(body.firmante_nombre) : null,
      firmar: body.firmar !== false,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo registrar el adelanto.';
    const status = msg.includes('Migración 332') ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
