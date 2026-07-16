import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { CartaSolicitudAnticipoPdfDocument } from '@/lib/obra-digital/pdf/CartaSolicitudAnticipoPdf';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET ?month=&year= — Carta de solicitud de anticipo (usa fila `obra_digital_monthly_advances` si existe).
 */
export async function GET(req: Request, ctx: { params: { contractId: string } }) {
  const { contractId } = ctx.params;
  const { searchParams } = new URL(req.url);
  const month = Number.parseInt(searchParams.get('month') ?? '', 10);
  const year = Number.parseInt(searchParams.get('year') ?? '', 10);
  if (!contractId || contractId.length < 32) {
    return NextResponse.json({ error: 'contractId inválido' }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year) || year < 2000) {
    return NextResponse.json({ error: 'month (1-12) y year requeridos' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: c, error: e1 } = await supabase
    .from('obra_digital_labor_contracts')
    .select('worker_name,worker_ci')
    .eq('id', contractId)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!c) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });

  const { data: adv } = await supabase
    .from('obra_digital_monthly_advances')
    .select('calculated_accrued,max_advance_allowed')
    .eq('contract_id', contractId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  const row = c as { worker_name: string; worker_ci: string };
  const a = adv as { calculated_accrued?: string | number; max_advance_allowed?: string | number } | null;
  const calculated = a?.calculated_accrued != null ? String(a.calculated_accrued) : '0.00';
  const max75 = a?.max_advance_allowed != null ? String(a.max_advance_allowed) : '0.00';

  const node = createElement(CartaSolicitudAnticipoPdfDocument, {
    workerName: row.worker_name,
    workerCi: row.worker_ci,
    month,
    year,
    calculatedAccrued: calculated,
    maxAdvanceAllowed: max75,
    generatedAt: new Date().toLocaleString('es-VE'),
  });

  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="carta-anticipo-${year}-${month}.pdf"`,
    },
  });
}
