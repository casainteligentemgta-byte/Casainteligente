import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { LibroObraSemanalPdfDocument } from '@/lib/obra-digital/pdf/LibroObraSemanalPdf';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** GET ?month=&year=&week= (semana 1–5 dentro del mes) — plantilla libro de obra. */
export async function GET(req: Request, ctx: { params: { contractId: string } }) {
  const { contractId } = ctx.params;
  const { searchParams } = new URL(req.url);
  const month = Number.parseInt(searchParams.get('month') ?? '', 10);
  const year = Number.parseInt(searchParams.get('year') ?? '', 10);
  const week = Number.parseInt(searchParams.get('week') ?? '', 10);
  if (!contractId || contractId.length < 32) {
    return NextResponse.json({ error: 'contractId inválido' }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year) || year < 2000) {
    return NextResponse.json({ error: 'month y year requeridos' }, { status: 400 });
  }
  if (!Number.isFinite(week) || week < 1 || week > 5) {
    return NextResponse.json({ error: 'week debe ser 1–5 (semana dentro del mes)' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: c, error } = await supabase
    .from('obra_digital_labor_contracts')
    .select('worker_name,worker_ci,oficio,lulo_partida_meta')
    .eq('id', contractId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!c) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });

  const row = c as {
    worker_name: string;
    worker_ci: string;
    oficio: string;
    lulo_partida_meta: string;
  };

  const node = createElement(LibroObraSemanalPdfDocument, {
    workerName: row.worker_name,
    workerCi: row.worker_ci,
    oficio: row.oficio,
    month,
    year,
    weekOfMonth: week,
    luloPartidaMeta: row.lulo_partida_meta,
    generatedAt: new Date().toLocaleString('es-VE'),
  });

  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="libro-obra-semana-${year}-${month}-s${week}.pdf"`,
    },
  });
}
