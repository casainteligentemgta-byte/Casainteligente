import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { enviarRecordatoriosCredito } from '@/lib/contabilidad/creditoRecordatorios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Diario: 3 días antes del vencimiento, el mismo día, y créditos ya vencidos. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const result = await enviarRecordatoriosCredito(createSupabaseAdminClient(), {
      incluirVencidos: true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/creditos-vencimiento]', err);
    const message = err instanceof Error ? err.message : 'Error en recordatorios de crédito';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
