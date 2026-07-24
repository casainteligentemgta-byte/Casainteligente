import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { hojaVidaDesdeRow, nombreCompletoDesde } from '@/lib/talento/hojaVidaObreroCompleta';
import { firmaTrabajadorMetaDesdeRow, HojaDeVidaObreroLegalPdfDoc } from '@/lib/talento/hojaVidaPdfLegal';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?token= — PDF de hoja de vida (sin patrono, obra ni contratación) a partir de `ci_empleados.token_registro`.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get('token') ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: emp, error } = await admin.client
    .from('ci_empleados')
    .select('*')
    .eq('token_registro', token)
    .maybeSingle();

  if (error) {
    console.error('[hoja-vida pdf]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!emp) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  const row = emp as Record<string, unknown>;
  const str = (k: string) => String(row[k] ?? '').trim();

  const emitidoEn = new Date().toLocaleString('es-VE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const completa = hojaVidaDesdeRow(row);
  const nombrePdf = nombreCompletoDesde(completa) || str('nombre_completo') || 'candidato';

  const firmaTrabajador = firmaTrabajadorMetaDesdeRow(row);

  const pdfNode = createElement(HojaDeVidaObreroLegalPdfDoc, {
    data: completa,
    meta: {
      emitidoEn,
      estadoProceso: str('estado_proceso'),
      rolBuscadoSistema: str('rol_buscado'),
      cargoCodigo: str('cargo_codigo'),
      cargoNombre: str('cargo_nombre'),
      firmaTrabajador,
      documentVariant: 'hoja_vida',
    },
  });
  const blob = await pdf(pdfNode as Parameters<typeof pdf>[0]).toBlob();

  const safeName = nombrePdf.replace(/[^\w\s-]/g, '').slice(0, 40) || 'candidato';

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="hoja-vida-${safeName}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
