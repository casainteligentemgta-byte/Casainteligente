import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { reintentarOcrPendientesCanal } from '@/lib/canal/reintentarOcrPendientes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Reintenta OCR transitorio con la foto ya guardada (álbum incluido). */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const result = await reintentarOcrPendientesCanal(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/facturas-ocr-reintentos]', err);
    const message = err instanceof Error ? err.message : 'Error en reintentos OCR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
