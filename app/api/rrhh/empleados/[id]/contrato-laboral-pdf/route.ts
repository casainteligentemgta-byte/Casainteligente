import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  cargarPropsContratoObreroPdfEstructurado,
  compilarContratoObreroDesdeEmpleadoId,
  parseOverridesContratoRequestBody,
} from '@/lib/talento/contratoObreroPdfContext';
import { construirExpedienteRefPorEmpleado } from '@/lib/talento/contratoExpedienteRef';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { ContratoLaboralObreroPdfDocument } from '@/lib/talento/ContratoLaboralObreroPdfStub';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function pdfPlantillaBiblioteca(
  supabase: SupabaseClient,
  empleadoId: string,
  expedienteRef: string,
  overrides?: Record<string, string>,
) {
  const out = await compilarContratoObreroDesdeEmpleadoId(supabase, empleadoId, overrides);
  if (!out.ok) {
    return { ok: false as const, error: out.error };
  }
  const pie =
    out.faltantes.length > 0
      ? 'Revise los recuadros [… COMPLETAR …]: complete la planilla de empleo, el expediente o los valores manuales indicados antes de la firma.'
      : null;
  const node = createElement(ContratoLaboralObreroPdfDocument, {
    expedienteId: expedienteRef,
    titulo: 'CONTRATO INDIVIDUAL DE TRABAJO',
    cuerpoTexto: out.texto,
    pieLegal: pie,
  });
  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());
  return { ok: true as const, buf };
}

async function handleRequest(req: Request, empleadoId: string, overrides?: Record<string, string>) {
  if (!empleadoId) {
    return NextResponse.json({ error: 'Falta id de empleado' }, { status: 400 });
  }

  const formato = new URL(req.url).searchParams.get('formato')?.toLowerCase() ?? '';

  try {
    const supabase = await createClient();
    const expedienteRef = await construirExpedienteRefPorEmpleado(supabase, empleadoId);

    if (formato === 'estructurado') {
      if (overrides && Object.keys(overrides).length > 0) {
        return NextResponse.json(
          { error: 'El PDF estructurado no admite overrides; use la plantilla biblioteca (sin query formato).' },
          { status: 400 },
        );
      }
      const st = await cargarPropsContratoObreroPdfEstructurado(supabase, empleadoId);
      if (!st.ok) {
        return NextResponse.json({ error: st.error }, { status: 404 });
      }
      const node = createElement(ContratoObreroPDF, {
        ...st.props,
        expedienteId: expedienteRef,
      });
      const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
      const buf = Buffer.from(await blob.arrayBuffer());
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="contrato-obrero-estructurado-${empleadoId.slice(0, 8)}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const built = await pdfPlantillaBiblioteca(supabase, empleadoId, expedienteRef, overrides);
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 404 });
    }

    return new NextResponse(built.buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contrato-obrero-${empleadoId.slice(0, 8)}.pdf"`,
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
