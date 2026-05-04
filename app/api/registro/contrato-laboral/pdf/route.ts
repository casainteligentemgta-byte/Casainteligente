import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { ContratoLaboralObreroPdfDocument } from '@/lib/talento/ContratoLaboralObreroPdfStub';
import { contratoObreroPorToken } from '@/lib/talento/contratoObreroToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

const NOTA_PLANTILLA =
  'Este PDF es una previsualización generada por el sistema. Cuando RRHH integre la plantilla legal definitiva, ' +
  'este documento se sustituirá por el formato oficial sin cambiar el flujo de aceptación e impresión.';

/**
 * GET ?contrato_id=&token= — PDF del contrato laboral (stub hasta plantilla definitiva).
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

  const { data: c, error: ec } = await admin.client
    .from('ci_contratos_empleado_obra')
    .select('texto_legal')
    .eq('id', contratoId)
    .maybeSingle();

  if (ec || !c) {
    return NextResponse.json({ error: ec?.message ?? 'Contrato no encontrado' }, { status: 404 });
  }

  const { data: emp, error: ee } = await admin.client
    .from('ci_empleados')
    .select('nombre_completo, documento, cedula')
    .eq('id', v.empleadoId)
    .maybeSingle();

  if (ee || !emp) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const texto = String((c as { texto_legal?: string }).texto_legal ?? '').trim() || '—';
  const e = emp as { nombre_completo: string | null; documento: string | null; cedula: string | null };
  const doc = (e.cedula ?? e.documento ?? '').trim() || '—';
  const nom = (e.nombre_completo ?? '').trim() || 'Trabajador';

  try {
    const node = createElement(ContratoLaboralObreroPdfDocument, {
      contratoId,
      nombreEmpleado: nom,
      documento: doc,
      textoLegalResumen: texto,
      notaPlantilla: NOTA_PLANTILLA,
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
