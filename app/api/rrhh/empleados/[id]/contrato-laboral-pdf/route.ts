import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generarBufferContratoLaboralEmpleado } from '@/lib/rrhh/empleadoContratoLaboralPdfBuffer';
import { parseOverridesContratoRequestBody } from '@/lib/talento/contratoObreroPdfContext';

export const runtime = 'nodejs';

async function handleRequest(req: Request, empleadoId: string, overrides?: Record<string, string>) {
  if (!empleadoId) {
    return NextResponse.json({ error: 'Falta id de empleado' }, { status: 400 });
  }

  const formato = new URL(req.url).searchParams.get('formato')?.toLowerCase() ?? '';

  try {
    const supabase = await createClient();
    const built = await generarBufferContratoLaboralEmpleado(supabase, empleadoId, { formato, overrides });
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(built.buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${built.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json({ error: 'Configuración Supabase incompleta en el servidor.' }, { status: 503 });
    }
    console.error('[contrato-laboral-pdf rrhh]', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
  }
}

/**
 * GET — PDF del contrato laboral obrero rellenado (plantilla + expediente).
 * Query `formato=estructurado`: PDF con cláusulas fijas (@react-pdf) en carta; por defecto plantilla biblioteca.
 */
export async function GET(req: Request, context: { params: { id: string } }) {
  const empleadoId = (context.params?.id ?? '').trim();
  return handleRequest(req, empleadoId, undefined);
}

/**
 * POST — Igual que GET en plantilla biblioteca, con cuerpo JSON `{ overrides: { CLAVE: "valor", … } }`
 * para completar manualmente placeholders pendientes (RRHH).
 */
export async function POST(req: Request, context: { params: { id: string } }) {
  const empleadoId = (context.params?.id ?? '').trim();
  let overrides: Record<string, string> | undefined;
  try {
    const ct = (req.headers.get('content-type') ?? '').toLowerCase();
    if (ct.includes('application/json')) {
      const body = await req.json();
      overrides = parseOverridesContratoRequestBody(body);
    }
  } catch {
    /* cuerpo inválido: se ignora overrides */
  }
  return handleRequest(req, empleadoId, overrides);
}
