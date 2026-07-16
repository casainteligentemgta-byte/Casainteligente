import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  resolverContratoPdfEmpleado,
  resolverContratoPdfExpress,
} from '@/lib/rrhh/resolverContratoPdfServer';

export const runtime = 'nodejs';

function streamPath(req: Request, params: Record<string, string>): string {
  const u = new URL('/api/rrhh/contrato-pdf/stream', new URL(req.url).origin);
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  return u.pathname + u.search;
}

/**
 * GET ?express_id= | ?empleado_id=
 * Resuelve URL del PDF (firmada en Storage o ruta de generación en el mismo origen).
 * Usa la sesión del usuario; no requiere service_role.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const expressId = (searchParams.get('express_id') ?? '').trim();
  const empleadoId = (searchParams.get('empleado_id') ?? '').trim();
  const preferFirmado = searchParams.get('doc')?.toLowerCase() === 'firmado';

  if (!expressId && !empleadoId) {
    return NextResponse.json({ error: 'Indique express_id o empleado_id.' }, { status: 400 });
  }
  if (expressId && empleadoId) {
    return NextResponse.json({ error: 'Use solo un identificador a la vez.' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    if (expressId) {
      const out = await resolverContratoPdfExpress(supabase, expressId, { preferFirmado });
      if (!out.ok) {
        return NextResponse.json({ error: out.error }, { status: out.status });
      }

      const streamParams: Record<string, string> = { express_id: expressId };
      if (preferFirmado) streamParams.doc = 'firmado';
      if (out.source === 'generate') streamParams.generar = '1';

      return NextResponse.json({
        url: streamPath(req, streamParams),
        source: out.source,
        expires_sec: out.source === 'storage' ? out.expires_sec : undefined,
        signed_url: out.source === 'storage' ? out.signedUrl ?? null : null,
      });
    }

    const out = await resolverContratoPdfEmpleado(supabase, empleadoId);
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: out.status });
    }

    const streamParams: Record<string, string> = { empleado_id: empleadoId };
    if (out.source === 'generate') streamParams.generar = '1';

    return NextResponse.json({
      url: streamPath(req, streamParams),
      source: out.source,
      expires_sec: out.source === 'storage' ? out.expires_sec : undefined,
      signed_url: out.source === 'storage' ? out.signedUrl ?? null : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json({ error: 'Configuración Supabase incompleta en el servidor.' }, { status: 503 });
    }
    console.error('[contrato-pdf/resolver]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
