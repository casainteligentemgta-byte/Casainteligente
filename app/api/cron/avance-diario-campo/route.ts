import { NextResponse } from 'next/server';
import { cronFinJornadaAvanceCampo } from '@/lib/telegram/avanceCampo';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization')?.trim();
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-cron-secret')?.trim() === secret) return true;
  if (req.headers.get('cron-secret')?.trim() === secret) return true;
  return false;
}

/**
 * Cron fin de jornada (17:00 Caracas ≈ 21:00 UTC en horario estándar).
 * Envía a cada ingeniero residente el botón «Reportar Avance de Hoy».
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: 'Supabase admin no configurado' },
      { status: 503 },
    );
  }

  try {
    const stats = await cronFinJornadaAvanceCampo(admin.client);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error cron avance campo';
    console.error('[cron avance-diario-campo]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
