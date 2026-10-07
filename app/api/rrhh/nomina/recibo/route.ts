import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReciboNominaObraPdf, type MetaReciboNomina } from '@/lib/nomina/ReciboNominaObraPdf';
import type { ResultadoSemanaObra } from '@/lib/nomina/calcularSemanaObra';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  let body: {
    cara?: MetaReciboNomina['cara'];
    meta?: Partial<MetaReciboNomina>;
    calc?: ResultadoSemanaObra;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.calc || !body.meta) {
    return NextResponse.json({ error: 'Faltan meta y cálculo del recibo.' }, { status: 400 });
  }

  const cara = body.cara ?? body.meta.cara ?? 'legal';
  const meta: MetaReciboNomina = {
    cara,
    empresa: String(body.meta.empresa ?? 'Entidad de trabajo'),
    obra: String(body.meta.obra ?? ''),
    trabajadorNombre: String(body.meta.trabajadorNombre ?? ''),
    trabajadorCedula: String(body.meta.trabajadorCedula ?? ''),
    semanaInicio: String(body.meta.semanaInicio ?? ''),
    semanaFin: String(body.meta.semanaFin ?? ''),
    solicitudTexto: body.meta.solicitudTexto,
    firmanteNombre: body.meta.firmanteNombre,
  };

  try {
    const node = createElement(ReciboNominaObraPdf, { meta, calc: body.calc });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    const slug = cara === 'patio' ? 'patio' : cara === 'adelanto' ? 'adelanto' : 'legal';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recibo-${slug}.pdf"`,
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (e) {
    console.error('[nomina recibo pdf]', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF.' }, { status: 500 });
  }
}
