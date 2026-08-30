import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  etiquetaEstadoCuota,
  redondearUsd,
  saldoPresupuesto,
  type BudgetAbono,
  type BudgetCuota,
} from '@/lib/presupuesto/cobros';

export const dynamic = 'force-dynamic';

function esUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function hintMigracion() {
  return {
    error: 'Aplique la migración 318_budgets_abonos_cuotas.sql y notify pgrst, \'reload schema\';',
    hint: '318_budgets_abonos_cuotas.sql',
  };
}

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  const supabase = await createClient();
  const { data: budget, error: bErr } = await supabase
    .from('budgets')
    .select('id, subtotal, monto_pagado, saldo, status, customer_name')
    .eq('id', id)
    .single();
  if (bErr || !budget) {
    if (/monto_pagado|budget_abonos|does not exist|schema cache/i.test(bErr?.message ?? '')) {
      return NextResponse.json(hintMigracion(), { status: 409 });
    }
    return NextResponse.json({ error: bErr?.message ?? 'Presupuesto no encontrado' }, { status: 404 });
  }

  const [abonosRes, cuotasRes] = await Promise.all([
    supabase.from('budget_abonos').select('*').eq('budget_id', id).order('fecha_abono', { ascending: false }),
    supabase.from('budget_cuotas').select('*').eq('budget_id', id).order('numero', { ascending: true }),
  ]);

  if (abonosRes.error || cuotasRes.error) {
    const msg = abonosRes.error?.message ?? cuotasRes.error?.message ?? '';
    if (/does not exist|schema cache/i.test(msg)) return NextResponse.json(hintMigracion(), { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const subtotal = Number(budget.subtotal) || 0;
  const abonos = (abonosRes.data ?? []) as BudgetAbono[];
  const montoPagado = redondearUsd(
    budget.monto_pagado != null
      ? Number(budget.monto_pagado)
      : abonos.reduce((a, x) => a + Number(x.monto_usd || 0), 0),
  );
  const cuotas = ((cuotasRes.data ?? []) as BudgetCuota[]).map((c) => ({
    ...c,
    estado_ui: etiquetaEstadoCuota(c),
  }));

  return NextResponse.json({
    ok: true,
    presupuesto: {
      id: budget.id,
      customer_name: budget.customer_name,
      status: budget.status,
      subtotal,
      monto_pagado: montoPagado,
      saldo: saldoPresupuesto(subtotal, montoPagado),
    },
    abonos,
    cuotas,
  });
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const monto = Number(body.monto ?? body.monto_recibido);
  const moneda = String(body.moneda ?? 'USD').toUpperCase() === 'VES' ? 'VES' : 'USD';
  const tasa = body.tasa_bcv != null ? Number(body.tasa_bcv) : null;
  let montoUsd = Number(body.monto_usd);
  if (!Number.isFinite(montoUsd) || montoUsd <= 0) {
    montoUsd = moneda === 'USD' ? monto : tasa && tasa > 0 ? monto / tasa : NaN;
  }
  if (!Number.isFinite(monto) || monto <= 0 || !Number.isFinite(montoUsd) || montoUsd <= 0) {
    return NextResponse.json({ error: 'Indique un monto válido' }, { status: 400 });
  }
  if (moneda === 'VES' && (!tasa || tasa <= 0)) {
    return NextResponse.json({ error: 'Indique la tasa BCV para el abono en bolívares' }, { status: 400 });
  }

  const fecha = String(body.fecha_abono ?? body.fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'fecha_abono requerida (YYYY-MM-DD)' }, { status: 400 });
  }

  const cuotaId = body.cuota_id != null && String(body.cuota_id) ? String(body.cuota_id) : null;
  if (cuotaId && !esUuid(cuotaId)) {
    return NextResponse.json({ error: 'cuota_id inválido' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ci_registrar_abono_presupuesto', {
    p_budget_id: id,
    p_monto: redondearUsd(monto),
    p_moneda: moneda,
    p_monto_usd: redondearUsd(montoUsd),
    p_tasa_bcv: moneda === 'VES' ? tasa : null,
    p_metodo: String(body.metodo ?? 'transferencia'),
    p_banco_origen: body.banco_origen != null ? String(body.banco_origen) : '',
    p_referencia: body.referencia != null ? String(body.referencia) : '',
    p_fecha_abono: fecha,
    p_notas: body.notas != null ? String(body.notas) : null,
    p_cuota_id: cuotaId,
  });

  if (error) {
    if (/does not exist|schema cache|ci_registrar_abono/i.test(error.message)) {
      return NextResponse.json(hintMigracion(), { status: 409 });
    }
    const status = /saldo|positivo|inválid|encontrado/i.test(error.message) ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, id: data }, { status: 201 });
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  const abonoId = new URL(req.url).searchParams.get('abono_id') ?? '';
  if (!esUuid(abonoId)) return NextResponse.json({ error: 'abono_id requerido' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc('ci_eliminar_abono_presupuesto', { p_abono_id: abonoId });
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(hintMigracion(), { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
