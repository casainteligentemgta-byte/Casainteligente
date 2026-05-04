import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { firmaTrabajadorMetaDesdeRow, HojaDeVidaObreroLegalPdfDoc } from '@/lib/talento/hojaVidaPdfLegal';
import { hojaVidaDesdeRow, nombreCompletoDesde } from '@/lib/talento/hojaVidaObreroCompleta';
import { resolvePlanillaPatronoPdf } from '@/lib/talento/resolvePlanillaPatronoPdf';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function normDoc(s: string) {
  return s.replace(/\s+/g, '').toUpperCase();
}

/**
 * GET ?empleadoId=&cedula= — Planilla legal PDF (firma electrónica si existe).
 * La cédula evita descarga arbitraria por UUID.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const empleadoId = (searchParams.get('empleadoId') ?? '').trim();
  const cedula = (searchParams.get('cedula') ?? '').trim();
  if (!empleadoId || !cedula) {
    return NextResponse.json({ error: 'empleadoId y cedula son requeridos' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: emp, error } = await admin.client.from('ci_empleados').select('*').eq('id', empleadoId).maybeSingle();

  if (error) {
    console.error('[planilla-empleo-pdf]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!emp) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  const row = emp as Record<string, unknown>;
  const str = (k: string) => String(row[k] ?? '').trim();
  const dbDoc = normDoc(str('cedula') || str('documento'));
  if (!dbDoc || dbDoc !== normDoc(cedula)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const emitidoEn = new Date().toLocaleString('es-VE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const completa = hojaVidaDesdeRow(row);
  const nombrePdf = nombreCompletoDesde(completa) || str('nombre_completo') || 'candidato';
  const planillaPatrono = await resolvePlanillaPatronoPdf(admin.client, row.proyecto_modulo_id as string | null | undefined);
  const firmaTrabajador = firmaTrabajadorMetaDesdeRow(row);

  const pdfNode = createElement(HojaDeVidaObreroLegalPdfDoc, {
    data: completa,
    meta: {
      emitidoEn,
      estadoProceso: str('estado_proceso'),
      rolBuscadoSistema: str('rol_buscado'),
      cargoCodigo: str('cargo_codigo'),
      cargoNombre: str('cargo_nombre'),
      planillaPatrono,
      firmaTrabajador,
    },
  });
  const blob = await pdf(pdfNode as Parameters<typeof pdf>[0]).toBlob();
  const safeName = nombrePdf.replace(/[^\w\s-]/g, '').slice(0, 40) || 'candidato';

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="planilla-empleo-${safeName}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
