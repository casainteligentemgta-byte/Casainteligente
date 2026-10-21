import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  enviarRecordatorioCompradores,
  esHoraDeRecordatorio,
} from '@/lib/compras/recordatorioCompradores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Cada hora de oficina (Caracas, L–V): recuerda a los compradores cargar facturas y notas. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!esHoraDeRecordatorio(new Date())) {
    return NextResponse.json({ ok: true, omitido: 'fuera_de_horario' });
  }
  try {
    const result = await enviarRecordatorioCompradores(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/recordatorio-compradores]', err);
    const message = err instanceof Error ? err.message : 'Error en recordatorio de compradores';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
