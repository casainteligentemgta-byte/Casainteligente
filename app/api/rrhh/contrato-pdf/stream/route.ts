import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generarBufferContratoExpressPdf } from '@/lib/rrhh/expressContratoPdfBuffer';
import { generarBufferContratoLaboralEmpleado } from '@/lib/rrhh/empleadoContratoLaboralPdfBuffer';
import {
  descargarPdfDesdeStorage,
  primeraRutaStorageEmpleado,
  primeraRutaStorageExpress,
} from '@/lib/rrhh/resolverContratoPdfServer';
import { construirExpedienteRefPorEmpleado } from '@/lib/talento/contratoExpedienteRef';
import { nombreArchivoPdfContratoIndividual } from '@/lib/talento/nombreArchivoContratoIndividual';

export const runtime = 'nodejs';

function pdfResponse(buf: Buffer, filename: string): NextResponse {
  const safe = filename.replace(/[\r\n"]/g, '_');
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safe}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

async function filenameDesdeExpress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expressId: string,
): Promise<string | null> {
  const full = await supabase
    .from('ci_contratos_express')
    .select('expediente_label,obrero_nombre,obrero_nombres,obrero_apellidos')
    .eq('id', expressId)
    .maybeSingle();
  let row = full.data as {
    expediente_label?: string | null;
    obrero_nombre?: string | null;
    obrero_nombres?: string | null;
    obrero_apellidos?: string | null;
  } | null;
  if (full.error && /column|42703|schema cache|Could not find/i.test(full.error.message)) {
    const lite = await supabase
      .from('ci_contratos_express')
      .select('obrero_nombre')
      .eq('id', expressId)
      .maybeSingle();
    row = lite.data as typeof row;
  }
  if (!row) return null;
  const nomenclatura = String(row.expediente_label ?? '').trim() || `EXPRESS-${expressId.slice(0, 8)}`;
  return nombreArchivoPdfContratoIndividual(nomenclatura, {
    nombres: row.obrero_nombres,
    apellidos: row.obrero_apellidos,
    nombreCompleto: row.obrero_nombre,
  });
}

async function filenameDesdeEmpleado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empleadoId: string,
): Promise<string | null> {
  const expedienteRef = await construirExpedienteRefPorEmpleado(supabase, empleadoId);
  const { data } = await supabase
    .from('ci_empleados')
    .select('nombre_completo,nombres')
    .eq('id', empleadoId)
    .maybeSingle();
  const emp = data as { nombre_completo?: string | null; nombres?: string | null } | null;
  if (!emp && !expedienteRef) return null;
  return nombreArchivoPdfContratoIndividual(expedienteRef, {
    nombres: emp?.nombres,
    nombreCompleto: emp?.nombre_completo,
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
            const named =
              (await filenameDesdeExpress(supabase, expressId)) ??
              `contrato-express-${expressId.slice(0, 8)}.pdf`;
            return pdfResponse(buf, named);
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
          const named =
            (await filenameDesdeEmpleado(supabase, empleadoId)) ??
            `contrato-obrero-${empleadoId.slice(0, 8)}.pdf`;
          return pdfResponse(buf, named);
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
