import { healthCheckObraToursWorker } from '@/lib/proyectos/obraToursWorker';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Diagnóstico: ¿responde el worker de Tours 3D? */
export async function GET() {
  const configured = Boolean(process.env.OBRA_TOURS_WORKER_URL?.trim());
  if (!configured) {
    return NextResponse.json({
      configured: false,
      ok: false,
      error: 'OBRA_TOURS_WORKER_URL no configurada (modo stub)',
    });
  }
  const health = await healthCheckObraToursWorker();
  return NextResponse.json(
    {
      configured: true,
      worker_url: process.env.OBRA_TOURS_WORKER_URL?.replace(/\/$/, ''),
      ...health,
    },
    { status: health.ok ? 200 : 503 },
  );
}
