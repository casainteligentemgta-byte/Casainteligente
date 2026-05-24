import { NextResponse } from 'next/server';
import { obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Varias fechas en una sola petición: ?fechas=2026-01-01,2026-02-15 */
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get('fechas') ?? '';
    const fechas = Array.from(
      new Set(
        raw
          .split(',')
          .map((f) => f.trim().slice(0, 10))
          .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)),
      ),
    ).slice(0, 60);

    if (!fechas.length) {
      return NextResponse.json({ tasas: {} as Record<string, number> });
    }

    const entries = await Promise.all(
      fechas.map(async (fecha) => {
        try {
          const r = await obtenerTasaBcvVesPorUsd(fecha);
          return [fecha, r.tasa_bcv_ves_por_usd] as const;
        } catch {
          return [fecha, null] as const;
        }
      }),
    );

    const tasas: Record<string, number> = {};
    for (const [fecha, tasa] of entries) {
      if (tasa != null && tasa > 0) tasas[fecha] = tasa;
    }

    return NextResponse.json(
      { tasas },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron obtener tasas BCV.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
