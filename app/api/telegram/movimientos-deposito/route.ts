import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { verificarInitDataTelegram } from '@/lib/telegram/miniAppInitData';
import {
  listarMovimientosMiniApp,
  resolverAccesoMovimientosTelegram,
} from '@/lib/telegram/movimientosDepositarioMiniApp';

export const dynamic = 'force-dynamic';

/** Mini App del depositario: valida la firma de Telegram y devuelve solo sus obras. */
export async function POST(request: Request) {
  let body: { initData?: unknown } = {};
  try {
    body = (await request.json()) as { initData?: unknown };
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 });

  const initData = typeof body.initData === 'string' ? body.initData : '';
  const verificado = verificarInitDataTelegram(initData, token);
  if (!verificado.ok) return NextResponse.json({ error: verificado.error }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const acceso = await resolverAccesoMovimientosTelegram(supabase, verificado.telegramId);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: 403 });

  const datos = await listarMovimientosMiniApp(supabase, acceso.obras);
  return NextResponse.json(
    { nombre: verificado.nombre, obras: acceso.obras, ...datos },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
