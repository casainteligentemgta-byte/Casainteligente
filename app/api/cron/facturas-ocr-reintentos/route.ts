import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  reintentarOcrPendientePorId,
  reintentarOcrPendientesCanal,
} from '@/lib/canal/reintentarOcrPendientes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function leerPendingId(req: NextRequest): Promise<string> {
  const q = req.nextUrl.searchParams.get('id')?.trim() ?? '';
  if (q) return q;
  if (req.method !== 'POST') return '';
  try {
    const body = (await req.json()) as { pendingId?: unknown } | null;
    return String(body?.pendingId ?? '').trim();
  } catch {
    return '';
  }
}

/** Reintenta OCR transitorio con la foto ya guardada (álbum incluido). */
async function ejecutar(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const supabase = createSupabaseAdminClient();
    const pendingId = await leerPendingId(req);
    const result = pendingId
      ? await reintentarOcrPendientePorId(supabase, pendingId, { forzar: true })
      : await reintentarOcrPendientesCanal(supabase);
    const { ok: exitosas, ...rest } = result;
    return NextResponse.json({ ok: true, exitosas, ...rest });
  } catch (err) {
    console.error('[cron/facturas-ocr-reintentos]', err);
    const message = err instanceof Error ? err.message : 'Error en reintentos OCR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return ejecutar(req);
}

export async function POST(req: NextRequest) {
  return ejecutar(req);
}
