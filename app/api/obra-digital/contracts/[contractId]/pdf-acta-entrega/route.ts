import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { ActaEntregaHerramientasPdfDocument } from '@/lib/obra-digital/pdf/ActaEntregaHerramientasPdf';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** GET — PDF acta de entrega (herramientas en BAJO_CUSTODIA). */
export async function GET(_req: Request, ctx: { params: { contractId: string } }) {
  const { contractId } = ctx.params;
  if (!contractId || contractId.length < 32) {
    return NextResponse.json({ error: 'contractId inválido' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: c, error: e1 } = await supabase
    .from('obra_digital_labor_contracts')
    .select('worker_name,worker_ci,oficio')
    .eq('id', contractId)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!c) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });

  const { data: tools, error: e2 } = await supabase
    .from('obra_digital_tool_assignments')
    .select('tool_name,serial_number,status')
    .eq('contract_id', contractId)
    .eq('status', 'BAJO_CUSTODIA');

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const row = c as { worker_name: string; worker_ci: string; oficio: string };
  const toolRows = (tools ?? []) as Array<{ tool_name: string; serial_number: string; status: string }>;

  const node = createElement(ActaEntregaHerramientasPdfDocument, {
    workerName: row.worker_name,
    workerCi: row.worker_ci,
    oficio: row.oficio,
    tools: toolRows.map((t) => ({
      toolName: t.tool_name,
      serialNumber: t.serial_number,
      status: t.status,
    })),
    generatedAt: new Date().toLocaleString('es-VE'),
  });

  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acta-entrega-herramientas-${contractId.slice(0, 8)}.pdf"`,
    },
  });
}
