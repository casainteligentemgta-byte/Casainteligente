import { NextResponse } from 'next/server';
import { sincronizarTasaBcvDiaria } from '@/lib/finanzas/bcvSync';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
 * Sync diario de la tasa oficial BCV (www.bcv.org.ve).
 * Horarios Caracas (UTC-4): 06:00, 09:00 y 13:00 → 10:00, 13:00 y 17:00 UTC.
 * Seguridad: Authorization Bearer CRON_SECRET (o x-cron-secret / cron-secret).
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const result = await sincronizarTasaBcvDiaria(admin.client);
    return NextResponse.json({
      ok: result.ok,
      hoy: result.hoy,
      fuente: result.filaHoy?.fuente ?? null,
      usd: result.filaHoy?.usd ?? null,
      fecha_valor: result.filaHoy?.fecha_valor ?? result.oficial?.fechaValor ?? null,
      alerta: result.alerta,
      alerta_enviada: result.alertaEnviada,
      error_oficial: result.errorOficial,
      upserts: result.upserts.map((u) => ({ fecha: u.fecha, fuente: u.fuente, usd: u.usd })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al sincronizar tasa BCV';
    console.error('[cron bcv-tasa]', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
