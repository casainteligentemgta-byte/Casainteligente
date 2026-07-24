import { NextResponse } from 'next/server';
import { enviarTelegramHtml } from '@/lib/alerts/telegramParadojaCeo';
import {
  buildWeeklyTalentoReport,
  formatTelegramWeeklyTalentoReport,
  rangoUltimos7Dias,
} from '@/lib/cron/weeklyTalentoReport';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

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
 * Cron semanal (Vercel Cron): reporte de talento al CEO vía Telegram.
 * Seguridad: `Authorization: Bearer ${CRON_SECRET}` (o cabeceras `x-cron-secret` / `cron-secret`).
 *
 * Horario sugerido en vercel.json: lunes 12:00 UTC ≈ 08:00 Caracas (America/Caracas).
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const rango = rangoUltimos7Dias();
  const reporte = await buildWeeklyTalentoReport(admin.client, rango);
  const text = formatTelegramWeeklyTalentoReport(reporte);
  const tg = await enviarTelegramHtml(text);

  if (!tg.ok) {
    return NextResponse.json(
      { ok: false, error: 'Fallo Telegram', status: tg.status, detail: tg.body.slice(0, 500) },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    periodo: { desde: rango.desdeIso, hasta: rango.hastaIso },
    resumen: {
      requisicionesNuevas: reporte.requisicionesNuevas,
      candidatosNuevos: reporte.candidatosNuevos,
      contratosEmitidos: reporte.contratosEmitidos,
    },
  });
}

/** Permite disparo manual con el mismo secreto (p. ej. curl POST). */
export async function POST(req: Request) {
  return GET(req);
}
