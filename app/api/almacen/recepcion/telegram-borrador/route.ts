import { NextResponse } from 'next/server';
import { obtenerBorradorRecepcionPorToken } from '@/lib/almacen/recepcionBorradorTelegram';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Falta token de borrador' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const borrador = await obtenerBorradorRecepcionPorToken(admin.client, token);
    if (!borrador) {
      return NextResponse.json(
        { error: 'Borrador no encontrado o expirado. Reinicie /ingresonotas en Telegram.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, borrador });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar borrador';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
