import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { requirePermisoRrhhAny, requirePermisoRrhhObra } from '@/lib/rrhh/requirePermisoRrhh';
import {
  cargarDatosCarnetEmpleado,
  emitirCarnetEmpleado,
} from '@/lib/rrhh/cargarDatosCarnetEmpleado';
import { CarnetDigitalPdfDocument } from '@/lib/rrhh/carnetDigitalPdf';

export const runtime = 'nodejs';

/** GET — PDF del carnet (emite código si aún no existe y `emitir=1`). */
export async function GET(req: Request, context: { params: { empleadoId: string } }) {
  const gate = await requirePermisoRrhhAny();
  if (!gate.ok) return gate.response;

  const empleadoId = (context.params?.empleadoId ?? '').trim();
  if (!empleadoId) {
    return NextResponse.json({ error: 'empleadoId requerido' }, { status: 400 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase();
  const emitir = url.searchParams.get('emitir') === '1';

  const loaded = emitir
    ? await emitirCarnetEmpleado(gate.supabase, empleadoId, {
        vigenteHasta: url.searchParams.get('vigente_hasta'),
      })
    : await cargarDatosCarnetEmpleado(gate.supabase, empleadoId);

  if (!loaded.ok) {
    const status = /migración 319/i.test(loaded.error) ? 503 : 404;
    return NextResponse.json({ error: loaded.error }, { status });
  }

  if (format === 'json') {
    return NextResponse.json({ ok: true, carnet: loaded.datos });
  }

  try {
    const doc = createElement(CarnetDigitalPdfDocument, { datos: loaded.datos });
    const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    const filename = `carnet-${loaded.datos.codigo.replace(/[^\w.-]+/g, '_')}.pdf`;
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[carnet pdf]', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF del carnet' }, { status: 500 });
  }
}

/** POST — Emite / reimprime carnet (persiste código + fecha). */
export async function POST(req: Request, context: { params: { empleadoId: string } }) {
  const gate = await requirePermisoRrhhObra();
  if (!gate.ok) return gate.response;

  const empleadoId = (context.params?.empleadoId ?? '').trim();
  if (!empleadoId) {
    return NextResponse.json({ error: 'empleadoId requerido' }, { status: 400 });
  }

  let vigenteHasta: string | null = null;
  try {
    const body = (await req.json()) as { vigente_hasta?: string };
    vigenteHasta = (body.vigente_hasta ?? '').trim() || null;
  } catch {
    /* sin body */
  }

  const out = await emitirCarnetEmpleado(gate.supabase, empleadoId, { vigenteHasta });
  if (!out.ok) {
    const status = /migración 319/i.test(out.error) ? 503 : 400;
    return NextResponse.json({ error: out.error }, { status });
  }

  return NextResponse.json({ ok: true, carnet: out.datos });
}
