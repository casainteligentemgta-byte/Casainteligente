import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fechaMasDias, redondearUsd, repartirCuotas, saldoPresupuesto } from '@/lib/presupuesto/cobros';

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

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const cantidad = Math.floor(Number(body.cantidad ?? 0));
  const primera = String(body.primera_fecha ?? '').slice(0, 10);
  const intervalo = Math.max(1, Math.floor(Number(body.intervalo_dias ?? 30)));
  if (cantidad < 1 || cantidad > 36) {
    return NextResponse.json({ error: 'Indique entre 1 y 36 cuotas' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(primera)) {
    return NextResponse.json({ error: 'primera_fecha requerida (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: budget, error: bErr } = await supabase
    .from('budgets')
    .select('id, subtotal, monto_pagado')
    .eq('id', id)
    .single();
  if (bErr || !budget) {
    if (/monto_pagado|does not exist|schema cache/i.test(bErr?.message ?? '')) {
      return NextResponse.json(hintMigracion(), { status: 409 });
    }
    return NextResponse.json({ error: bErr?.message ?? 'Presupuesto no encontrado' }, { status: 404 });
  }

  const { data: pagadas, error: pErr } = await supabase
    .from('budget_cuotas')
    .select('id, monto_pagado')
    .eq('budget_id', id)
    .gt('monto_pagado', 0);
  if (pErr) {
    if (/does not exist|schema cache/i.test(pErr.message)) return NextResponse.json(hintMigracion(), { status: 409 });
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const { error: delErr } = await supabase
    .from('budget_cuotas')
    .delete()
    .eq('budget_id', id)
    .eq('monto_pagado', 0);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { count: existentes } = await supabase
    .from('budget_cuotas')
    .select('id', { count: 'exact', head: true })
    .eq('budget_id', id);

  const yaPagadoCuotas = (pagadas ?? []).reduce((a, c) => a + Number(c.monto_pagado || 0), 0);
  const subtotal = Number(budget.subtotal) || 0;
  const pagado = Number(budget.monto_pagado) || 0;
  const restante = saldoPresupuesto(subtotal, Math.max(pagado, yaPagadoCuotas));
  if (restante <= 0) {
    return NextResponse.json({ error: 'No hay saldo para planificar cuotas' }, { status: 400 });
  }

  let montos: number[] = [];
  if (Array.isArray(body.montos) && body.montos.length) {
    montos = body.montos.map((x) => redondearUsd(Number(x))).filter((x) => x > 0);
    const suma = redondearUsd(montos.reduce((a, b) => a + b, 0));
    if (Math.abs(suma - restante) > 0.02) {
      return NextResponse.json(
        { error: `Los montos deben sumar el saldo ($${restante.toFixed(2)})` },
        { status: 400 },
      );
    }
  } else {
    montos = repartirCuotas(restante, cantidad);
  }

  const startNumero = (existentes ?? 0) + 1;
  const filas = montos.map((monto, i) => ({
    budget_id: id,
    numero: startNumero + i,
    monto,
    fecha_vencimiento: fechaMasDias(primera, intervalo * i),
    estado: 'pendiente',
    monto_pagado: 0,
  }));

  const { data, error } = await supabase.from('budget_cuotas').insert(filas).select('*').order('numero');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cuotas: data }, { status: 201 });
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  const cuotaId = new URL(req.url).searchParams.get('cuota_id');

  const supabase = await createClient();
  if (cuotaId) {
    if (!esUuid(cuotaId)) return NextResponse.json({ error: 'cuota_id inválido' }, { status: 400 });
    const { data: row, error: gErr } = await supabase
      .from('budget_cuotas')
      .select('id, monto_pagado')
      .eq('id', cuotaId)
      .eq('budget_id', id)
      .maybeSingle();
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 });
    if (Number(row.monto_pagado) > 0) {
      return NextResponse.json({ error: 'No se puede borrar una cuota con abonos' }, { status: 400 });
    }
    const { error } = await supabase.from('budget_cuotas').delete().eq('id', cuotaId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from('budget_cuotas').delete().eq('budget_id', id).eq('monto_pagado', 0);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json(hintMigracion(), { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
