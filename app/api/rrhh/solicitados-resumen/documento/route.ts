import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadResumenSolicitadosOficios } from '@/lib/rrhh/loadResumenSolicitadosOficios';
import { buildResumenSolicitadosPrintHtml } from '@/lib/rrhh/resumenSolicitadosPrintHtml';
import { ResumenSolicitadosOficiosPdf } from '@/lib/rrhh/ResumenSolicitadosOficiosPdf';

export const runtime = 'nodejs';

function slugNombre(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48)
    .toLowerCase() || 'proyecto';
}

/**
 * GET /api/rrhh/solicitados-resumen/documento?proyecto_modulo=… | proyecto=…
 * HTML imprimible (por defecto) o PDF con `format=pdf`. `print=1` abre diálogo de impresión.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const proyectoModulo = url.searchParams.get('proyecto_modulo')?.trim() ?? '';
  const proyectoObra = url.searchParams.get('proyecto')?.trim() ?? '';
  const format = url.searchParams.get('format')?.toLowerCase() ?? '';
  const autoPrint = url.searchParams.get('print') === '1';

  if (!proyectoModulo && !proyectoObra) {
    return NextResponse.json({ error: 'Indique proyecto_modulo o proyecto' }, { status: 400 });
  }

  const supabase = await createClient();
  const loaded = await loadResumenSolicitadosOficios(supabase, {
    proyectoModuloId: proyectoModulo || undefined,
    proyectoObraId: proyectoObra || undefined,
  });

  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 404 });
  }

  const slug = slugNombre(loaded.alcanceNombre);

  if (format === 'pdf') {
    try {
      const node = createElement(ResumenSolicitadosOficiosPdf, loaded);
      const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
      const buf = Buffer.from(await blob.arrayBuffer());
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="resumen-solicitados-${slug}.pdf"`,
          'Cache-Control': 'private, max-age=60',
        },
      });
    } catch (e) {
      console.error('[solicitados-resumen documento pdf]', e);
      return NextResponse.json({ error: 'No se pudo generar el PDF' }, { status: 500 });
    }
  }

  const html = buildResumenSolicitadosPrintHtml(loaded, { autoPrint });
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="resumen-solicitados-${slug}.html"`,
    },
  });
}
