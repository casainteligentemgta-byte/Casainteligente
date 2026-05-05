import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { cargarFuentesContratoObreroPdf } from '@/lib/talento/contratoObreroPdfContext';
import { ContratoLaboralObreroPdfDocument } from '@/lib/talento/ContratoLaboralObreroPdfStub';
import { contratoObreroPorToken } from '@/lib/talento/contratoObreroToken';
import {
  compilarPlantillaContratoObrero,
  construirMapaVariablesContratoObrero,
} from '@/lib/talento/plantillaContratoObreroCompile';
import { obtenerCuerpoPlantillaContratoObrero } from '@/lib/talento/plantillaContratoObreroRepo';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?contrato_id=&token= — PDF del contrato laboral (plantilla biblioteca + datos expediente / hoja de empleo).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contratoId = (searchParams.get('contrato_id') ?? '').trim();
  const token = (searchParams.get('token') ?? '').trim();
  if (!contratoId || !token) {
    return NextResponse.json({ error: 'contrato_id y token requeridos' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const v = await contratoObreroPorToken(admin.client, contratoId, token);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const fu = await cargarFuentesContratoObreroPdf(admin.client, contratoId);
  if (!fu.ok) {
    return NextResponse.json({ error: fu.error }, { status: 400 });
  }

  let cuerpo: string;
  try {
    cuerpo = await obtenerCuerpoPlantillaContratoObrero(admin.client);
  } catch (e) {
    console.error('[contrato-laboral pdf] plantilla', e);
    return NextResponse.json({ error: 'No se pudo cargar la plantilla del contrato' }, { status: 500 });
  }

  const mapa = construirMapaVariablesContratoObrero(fu.fuentes);
  const { texto, faltantes } = compilarPlantillaContratoObrero(cuerpo, mapa);
  const pie =
    faltantes.length > 0
      ? 'Revise los recuadros [… COMPLETAR …] con su planilla de empleo o solicite ayuda a RRHH antes de firmar.'
      : null;

  try {
    const node = createElement(ContratoLaboralObreroPdfDocument, {
      expedienteId: contratoId,
      titulo: 'CONTRATO INDIVIDUAL DE TRABAJO',
      cuerpoTexto: texto,
      pieLegal: pie,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contrato-laboral-${contratoId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[contrato-laboral pdf]', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
  }
}
