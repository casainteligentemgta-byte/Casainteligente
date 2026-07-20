import { NextResponse } from 'next/server';
import { crearSnapshotsDiariosTodasLasObras } from '@/lib/contabilidad/cco/snapshots';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
 * Cron diario: snapshot CCO por obra con config.
 * Horario sugerido: 04:00 UTC ≈ 00:00 Caracas.
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const stats = await crearSnapshotsDiariosTodasLasObras(admin.client);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error cron snapshots CCO';
    console.error('[cron cco-snapshots-diarios]', err);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: /cco_snapshots|275/i.test(msg)
          ? 'Ejecuta migración 275_cco_snapshots_restauracion.sql'
          : undefined,
      },
      { status: 500 },
    );
  }
}
