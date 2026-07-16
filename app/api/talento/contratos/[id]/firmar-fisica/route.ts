import { NextResponse } from 'next/server';
import { supabaseForRoute } from '@/lib/talento/supabase-route';

export const runtime = 'nodejs';

/**
 * POST — Marca el contrato como firmado en físico (huella + autógrafo) y activo.
 * Solo desde estado `firmado_electronico`.
 */
export async function POST(_req: Request, context: { params: { id: string } }) {
  const id = context.params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de contrato' }, { status: 400 });
  }

  const sb = supabaseForRoute();
  if (!sb.ok) return sb.response;

  const { data: row, error: sel } = await sb.client
    .from('ci_contratos_empleado_obra')
    .select('id, estado_contrato, obrero_aceptacion_contrato_at')
    .eq('id', id)
    .maybeSingle();

  if (sel) {
    console.error('[firmar-fisica]', sel);
    return NextResponse.json({ error: sel.message }, { status: 500 });
  }

  const r = row as {
    id: string;
    estado_contrato?: string | null;
    obrero_aceptacion_contrato_at?: string | null;
  } | null;
  if (!r) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }

  const estado = (r.estado_contrato ?? '').trim();
  const aceptObrero = r.obrero_aceptacion_contrato_at != null;
  const listoParaFirmaFisica = estado === 'firmado_electronico' || (estado === 'generado' && aceptObrero);
  if (!listoParaFirmaFisica) {
    return NextResponse.json(
      {
        error: `El contrato no está listo para confirmar firma física (estado: ${estado || '—'}). ${
          estado === 'generado' && !aceptObrero
            ? 'El obrero debe aceptar el contrato en la web antes de imprimir y firmar en físico.'
            : ''
        }`.trim(),
      },
      { status: 409 },
    );
  }

  const ahora = new Date().toISOString();
  const { error: up } = await sb.client
    .from('ci_contratos_empleado_obra')
    .update({
      estado_contrato: 'firmado_activo',
      firmado_fisico_at: ahora,
    } as never)
    .eq('id', id);

  if (up) {
    console.error('[firmar-fisica] update', up);
    return NextResponse.json({ error: up.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, estado_contrato: 'firmado_activo', firmado_fisico_at: ahora });
}
