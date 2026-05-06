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

async function construirExpedienteRefPorContrato(supabase: any, contratoId: string) {
  const nowYear = new Date().getFullYear();
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,created_at,obra_id,proyecto_id')
    .eq('id', contratoId)
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
  const expedienteRef = await construirExpedienteRefPorContrato(admin.client, contratoId);

  try {
    const node = createElement(ContratoLaboralObreroPdfDocument, {
      expedienteId: expedienteRef,
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
