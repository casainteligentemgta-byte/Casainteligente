import { NextResponse } from 'next/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';
import { hoyIsoCaracas } from '@/lib/finanzas/bcvOficial';
import { sincronizarTasaBcvDiaria } from '@/lib/finanzas/bcvSync';
import { leerTasaBcvPorFecha, obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get('fecha') ?? hoyIsoCaracas();
    const iso = fecha.trim().slice(0, 10);
    // La tasa es un dato público, pero su respaldo está en la configuración de nómina,
    // que solo lee el servidor: así responde igual con o sin sesión.
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    if (supabase && iso === hoyIsoCaracas()) {
      const ya = await leerTasaBcvPorFecha(supabase, iso).catch(() => null);
      if (!ya) {
        await sincronizarTasaBcvDiaria(supabase, { alertar: false }).catch((e) => {
          console.warn('[GET /api/finanzas/bcv-tasa] sync', e instanceof Error ? e.message : e);
        });
      }
    }
    const result = await obtenerTasaBcvVesPorUsd(fecha, { supabase });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo obtener la tasa BCV.';
    console.error('[GET /api/finanzas/bcv-tasa]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
