import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FichaLaboralObraDigitalPdfDocument } from '@/lib/obra-digital/pdf/FichaLaboralObraDigitalPdf';
import { assertCedulaRegistradaParaPdfLaboral } from '@/lib/obra-digital/validation';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  contractId: z.string().uuid(),
});

/**
 * POST /api/contracts/generate-pdf
 * Cuerpo: { contractId }. Exige documento CEDULA en `obra_digital_documents`; si no, 400 "Falta Cédula del Obrero".
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'contractId UUID requerido' }, { status: 400 });
  }

  const supabase = await createClient();
  const gate = await assertCedulaRegistradaParaPdfLaboral(supabase, parsed.data.contractId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: 400 });
  }

  const { data: c, error } = await supabase
    .from('obra_digital_labor_contracts')
    .select('worker_name,worker_ci,oficio,salary_per_day,lulo_partida_meta,contract_status')
    .eq('id', parsed.data.contractId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!c) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }

  const row = c as {
    worker_name: string;
    worker_ci: string;
    oficio: string;
    salary_per_day: string | number;
    lulo_partida_meta: string;
    contract_status: string;
  };

  const node = createElement(FichaLaboralObraDigitalPdfDocument, {
    workerName: row.worker_name,
    workerCi: row.worker_ci,
    oficio: row.oficio,
    salaryPerDay: String(row.salary_per_day),
    luloPartidaMeta: row.lulo_partida_meta,
    contractStatus: row.contract_status,
    generatedAt: new Date().toLocaleString('es-VE'),
  });

  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ficha-laboral-${parsed.data.contractId.slice(0, 8)}.pdf"`,
    },
  });
}
