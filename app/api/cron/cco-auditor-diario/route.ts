import { NextResponse } from 'next/server';
import { ejecutarAuditorContinuoCco } from '@/lib/contabilidad/cco/auditorContinuo';
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
 * Cron diario: revisa tablas CCO + contratos de todas las obras con config.
 * Solo notifica por Telegram si hay hallazgos.
 * Horario sugerido: 04:15 UTC (tras snapshots 04:00).
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const result = await ejecutarAuditorContinuoCco(admin.client, {
      actor: 'cron_auditor_diario',
      notificar: true,
      persistir: true,
    });

    return NextResponse.json({
      ok: true,
      revisadas: result.revisadas,
      con_hallazgos: result.con_hallazgos,
      total_hallazgos: result.total_hallazgos,
      notificado: result.notificado,
      notify_razon: result.notify_razon,
      obras: result.obras.map((o) => ({
        proyecto_id: o.proyecto_id,
        obra_label: o.obra_label,
        hallazgos: o.hallazgos.length,
        severidad_max: o.hallazgos.some((h) => h.severidad === 'alta')
          ? 'alta'
          : o.hallazgos.some((h) => h.severidad === 'media')
            ? 'media'
            : o.hallazgos.length
              ? 'baja'
              : 'ok',
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error cron auditor CCO';
    console.error('[cron cco-auditor-diario]', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
