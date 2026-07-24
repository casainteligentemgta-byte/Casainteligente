import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { HojaDeVidaObreroLegalPlantillaPdfDoc } from '@/lib/talento/hojaVidaPdfLegal';

export const runtime = 'nodejs';

/** Plantilla PDF pública (sin datos personales) para RRHH y campo. */
export async function GET() {
  const pdfNode = createElement(HojaDeVidaObreroLegalPlantillaPdfDoc);
  const blob = await pdf(pdfNode as Parameters<typeof pdf>[0]).toBlob();

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="plantilla-hoja-vida-casa-inteligente.pdf"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
