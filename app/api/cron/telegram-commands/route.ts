import { NextRequest, NextResponse } from 'next/server';
import {
  publicarMenuComandosTelegram,
  sanitizarTextoConToken,
} from '@/lib/telegram/publicarMenuComandos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Publica el menú nativo de Telegram (setMyCommands) si difiere de la lista canónica.
 * Token solo en el servidor; nunca se loguea ni se devuelve.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const result = await publicarMenuComandosTelegram();
    if (!result.ok) {
      console.warn('[cron/telegram-commands]', result.error);
      const status = /no configurado/i.test(result.error) ? 503 : 502;
      return NextResponse.json({ ok: false, error: result.error }, { status });
    }
    return NextResponse.json({
      ok: true,
      actualizado: result.actualizado,
      comandos: result.comandos,
    });
  } catch (err) {
    const message = sanitizarTextoConToken(
      err instanceof Error ? err.message : 'Error al publicar comandos',
      process.env.TELEGRAM_BOT_TOKEN,
    );
    console.warn('[cron/telegram-commands]', message);
    return NextResponse.json({ error: 'Error al publicar comandos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
