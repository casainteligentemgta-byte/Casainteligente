import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { enviarAvisosCuellosBotella } from '@/lib/compras/cuellosBotella';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Aviso diario: a cada responsable, lo que tiene detenido en la cadena de compras. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const result = await enviarAvisosCuellosBotella(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/cuellos-botella]', err);
    const message = err instanceof Error ? err.message : 'Error en cuellos de botella';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
