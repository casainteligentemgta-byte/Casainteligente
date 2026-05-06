import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  cargarPropsContratoObreroPdfEstructurado,
  compilarContratoObreroDesdeEmpleadoId,
} from '@/lib/talento/contratoObreroPdfContext';
import { construirExpedienteRefPorEmpleado } from '@/lib/talento/contratoExpedienteRef';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { ContratoLaboralObreroPdfDocument } from '@/lib/talento/ContratoLaboralObreroPdfStub';

export const runtime = 'nodejs';

/**
 * GET — PDF del contrato laboral obrero rellenado (plantilla + expediente).
 * Query `formato=estructurado`: PDF con cláusulas fijas (@react-pdf) en carta; por defecto plantilla biblioteca.
 * No exige sesión; el acceso efectivo depende de RLS/políticas del cliente Supabase del servidor.
 */
export async function GET(req: Request, context: { params: { id: string } }) {
  const empleadoId = (context.params?.id ?? '').trim();
  if (!empleadoId) {
    return NextResponse.json({ error: 'Falta id de empleado' }, { status: 400 });
  }

  const formato = new URL(req.url).searchParams.get('formato')?.toLowerCase() ?? '';

  try {
    const supabase = await createClient();
    const expedienteRef = await construirExpedienteRefPorEmpleado(supabase, empleadoId);

    if (formato === 'estructurado') {
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

    const out = await compilarContratoObreroDesdeEmpleadoId(supabase, empleadoId);
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: 404 });
    }

    const pie =
      out.faltantes.length > 0
        ? 'Revise los recuadros [… COMPLETAR …]: complete la planilla de empleo o los datos del expediente antes de la firma.'
        : null;

    const node = createElement(ContratoLaboralObreroPdfDocument, {
      expedienteId: expedienteRef,
      titulo: 'CONTRATO INDIVIDUAL DE TRABAJO',
      cuerpoTexto: out.texto,
      pieLegal: pie,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(buf, {
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
