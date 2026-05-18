import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generarBufferContratoExpressPdf } from '@/lib/rrhh/expressContratoPdfBuffer';
import { generarBufferContratoLaboralEmpleado } from '@/lib/rrhh/empleadoContratoLaboralPdfBuffer';
import {
  descargarPdfDesdeStorage,
  primeraRutaStorageEmpleado,
  primeraRutaStorageExpress,
} from '@/lib/rrhh/resolverContratoPdfServer';

export const runtime = 'nodejs';

function pdfResponse(buf: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/**
 * GET ?express_id= | ?empleado_id= [&generar=1]
 * Sirve el PDF en el mismo origen (Storage o generación on-the-fly).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const expressId = (searchParams.get('express_id') ?? '').trim();
  const empleadoId = (searchParams.get('empleado_id') ?? '').trim();
  const preferFirmado = searchParams.get('doc')?.toLowerCase() === 'firmado';
  const forzarGenerar = searchParams.get('generar') === '1';

  if (!expressId && !empleadoId) {
    return NextResponse.json({ error: 'Indique express_id o empleado_id.' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    if (expressId) {
      if (!forzarGenerar) {
        const path = await primeraRutaStorageExpress(supabase, expressId, preferFirmado);
        if (path) {
          const dl = await descargarPdfDesdeStorage(supabase, path);
          if (dl.ok) {
            const buf = Buffer.from(await dl.data.arrayBuffer());
            return pdfResponse(buf, `contrato-express-${expressId.slice(0, 8)}.pdf`);
          }
        }
      }

      const built = await generarBufferContratoExpressPdf(supabase, expressId);
      if (!built.ok) {
        return NextResponse.json({ error: built.error }, { status: 404 });
      }
      return pdfResponse(built.buf, built.filename);
    }

    if (!forzarGenerar) {
      const path = await primeraRutaStorageEmpleado(supabase, empleadoId);
      if (path) {
        const dl = await descargarPdfDesdeStorage(supabase, path);
        if (dl.ok) {
          const buf = Buffer.from(await dl.data.arrayBuffer());
          return pdfResponse(buf, `contrato-obrero-${empleadoId.slice(0, 8)}.pdf`);
        }
      }
    }

    const built = await generarBufferContratoLaboralEmpleado(supabase, empleadoId);
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 404 });
    }
    return pdfResponse(built.buf, built.filename);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json({ error: 'Configuración Supabase incompleta en el servidor.' }, { status: 503 });
    }
    console.error('[contrato-pdf/stream]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
