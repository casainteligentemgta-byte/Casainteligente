import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compilarContratoObreroDesdeEmpleadoId } from '@/lib/talento/contratoObreroPdfContext';
import { ContratoLaboralObreroPdfDocument } from '@/lib/talento/ContratoLaboralObreroPdfStub';

export const runtime = 'nodejs';

async function construirExpedienteRefPorEmpleado(supabase: Awaited<ReturnType<typeof createClient>>, empleadoId: string) {
  const nowYear = new Date().getFullYear();
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at,obra_id,proyecto_id')
    .eq('empleado_id', empleadoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const c = ctr as
    | { id: string; created_at?: string | null; obra_id?: string | null; proyecto_id?: string | null }
    | null;
  if (!c) return `${nowYear}-0001`;

  const sitioId = String(c.obra_id ?? c.proyecto_id ?? '').trim();
  const createdAt = String(c.created_at ?? '').trim();
  const year = createdAt ? new Date(createdAt).getFullYear() : nowYear;
  if (!sitioId || !Number.isFinite(year)) return `${nowYear}-0001`;

  const { data: rows } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at')
    .or(`obra_id.eq.${sitioId},proyecto_id.eq.${sitioId}`);

  const sameYear = ((rows ?? []) as Array<{ id?: string; created_at?: string | null }>)
    .filter((r) => {
      const d = new Date(String(r.created_at ?? ''));
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime());

  const idx = sameYear.findIndex((r) => String(r.id ?? '') === c.id);
  const seq = String(idx >= 0 ? idx + 1 : sameYear.length || 1).padStart(4, '0');
  return `${year}-${seq}`;
}

/**
 * GET — PDF del contrato laboral obrero rellenado (plantilla + expediente).
 * No exige sesión; el acceso efectivo depende de RLS/políticas del cliente Supabase del servidor.
 */
export async function GET(_req: Request, context: { params: { id: string } }) {
  const empleadoId = (context.params?.id ?? '').trim();
  if (!empleadoId) {
    return NextResponse.json({ error: 'Falta id de empleado' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const out = await compilarContratoObreroDesdeEmpleadoId(supabase, empleadoId);
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: 404 });
    }

    const pie =
      out.faltantes.length > 0
        ? 'Revise los recuadros [… COMPLETAR …]: complete la planilla de empleo o los datos del expediente antes de la firma.'
        : null;
    const expedienteRef = await construirExpedienteRefPorEmpleado(supabase, empleadoId);

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
