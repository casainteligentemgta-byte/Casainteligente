import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';
import { cargarRendicionHonorarios } from '@/lib/contabilidad/cco/cargarRendicionHonorarios';
import { RendicionHonorariosPdfDocument } from '@/lib/contabilidad/cco/RendicionHonorariosPdf';
import { nombreArchivoRendicion } from '@/lib/contabilidad/cco/rendicionHonorarios';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { leerParametrosRendicion } from '@/lib/contabilidad/cco/parametrosRendicion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** GET ?proyecto=&periodo=&fecha=&version= — rendición de cuentas en PDF. */
export async function GET(req: Request) {
  try {
    const acceso = await requireCcoAcceso('ver');
    if (!acceso.ok) return acceso.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const params = leerParametrosRendicion(req.url);
    if (!params.proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const cargada = await cargarRendicionHonorarios(admin.client, {
      proyectoId: params.proyectoId,
      periodo: params.periodo,
      fecha: params.fecha,
    });
    if (!cargada) {
      return NextResponse.json({ ok: false, error: 'No se encontró la obra.' }, { status: 404 });
    }

    const node = createElement(RendicionHonorariosPdfDocument, {
      obra: cargada.obra,
      cliente: cargada.cliente,
      empresa: cargada.empresa,
      version: params.version,
      generadoAt: new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
      rendicion: cargada.rendicion,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    const archivo = nombreArchivoRendicion(cargada.obra, cargada.rendicion.rango, params.version);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${archivo}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al generar el PDF de la rendición.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
