import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { enviarAlertaNotasSinFactura } from '@/lib/compras/notasSinFactura';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Aviso semanal (lunes): notas de entrega sin factura con 5 días continuos o más. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const result = await enviarAlertaNotasSinFactura(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/notas-sin-factura]', err);
    const message = err instanceof Error ? err.message : 'Error en alerta de notas sin factura';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
