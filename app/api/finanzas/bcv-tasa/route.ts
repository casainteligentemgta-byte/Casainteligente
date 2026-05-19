import { NextResponse } from 'next/server';
import { obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get('fecha') ?? new Date().toISOString().slice(0, 10);
    const result = await obtenerTasaBcvVesPorUsd(fecha);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo obtener la tasa BCV.';
    console.error('[GET /api/finanzas/bcv-tasa]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
