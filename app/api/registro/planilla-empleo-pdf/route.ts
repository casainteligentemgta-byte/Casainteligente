import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { cedulaAuthCoincide, cedulaEfectivaDesdeEmpleado } from '@/lib/talento/cedulaAuth';
import { firmaTrabajadorMetaDesdeRow, HojaDeVidaObreroLegalPdfDoc } from '@/lib/talento/hojaVidaPdfLegal';
import { hojaVidaDesdeRow, nombreCompletoDesde } from '@/lib/talento/hojaVidaObreroCompleta';
import { resolvePlanillaPatronoPdf } from '@/lib/talento/resolvePlanillaPatronoPdf';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?empleadoId=&cedula=&tipo=
 * - tipo=hoja_empleo (defecto): HOJA DE EMPLEO — I trabajador, II patrono, III obra, IV contratación + resto.
 * - tipo=hoja_vida: solo trabajador y antecedentes personales (sin patrono/obra/contratación).
 * La cédula evita descarga arbitraria por UUID.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const empleadoId = (searchParams.get('empleadoId') ?? '').trim();
  const cedula = (searchParams.get('cedula') ?? '').trim().replace(/\uFEFF/g, '');
  const tipoRaw = (searchParams.get('tipo') ?? 'hoja_empleo').trim().toLowerCase();
  const documentVariant = tipoRaw === 'hoja_vida' ? 'hoja_vida' : 'hoja_empleo';
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

  const completa = hojaVidaDesdeRow(row);
  const dbCedula = cedulaEfectivaDesdeEmpleado(row, completa);
  if (!cedulaAuthCoincide(dbCedula, cedula)) {
    return NextResponse.json(
      { error: 'No autorizado', hint: 'La cédula en la URL no coincide con el expediente (revisa mayúsculas, puntos o prefijo V/E).' },
      { status: 403 },
    );
  }

  const emitidoEn = new Date().toLocaleString('es-VE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const nombrePdf = nombreCompletoDesde(completa) || str('nombre_completo') || 'candidato';
  const planillaPatrono =
    documentVariant === 'hoja_empleo'
      ? await resolvePlanillaPatronoPdf(admin.client, row.proyecto_modulo_id as string | null | undefined)
      : {};
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
      documentVariant,
    },
  });
  let blob: Blob;
  try {
    blob = await pdf(pdfNode as Parameters<typeof pdf>[0]).toBlob();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[planilla-empleo-pdf] render', e);
    return NextResponse.json(
      { error: 'No se pudo generar el PDF', detail: msg },
      { status: 500 },
    );
  }
  const safeName = nombrePdf.replace(/[^\w\s-]/g, '').slice(0, 40) || 'candidato';
  const body = await blob.arrayBuffer();
  const fileSlug = documentVariant === 'hoja_empleo' ? 'hoja-empleo' : 'hoja-vida';

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileSlug}-${safeName}.pdf"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
