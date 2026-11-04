import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nombreObraDesdePresupuesto, payloadObraDesdePresupuesto } from '@/lib/presupuesto/convertirObra';
import { totalConIvaDe } from '@/lib/presupuesto/iva';
import { numeroPresupuesto } from '@/lib/presupuesto/datosPresupuesto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * POST /api/budgets/[id]/convertir-obra
 * Crea ci_proyectos con cliente, entidad, budget_id y nombre.
 * El INSERT dispara el trigger 388 (almacén de obra).
 */
export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const { data: budget, error: bErr } = await supabase
    .from('budgets')
    .select('id, customer_id, customer_name, subtotal, iva_pct, iva_monto, status, numero_correlativo')
    .eq('id', id)
    .maybeSingle();
  if (bErr || !budget) {
    return NextResponse.json({ error: bErr?.message ?? 'Presupuesto no encontrado' }, { status: 404 });
  }

  const ya = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .eq('budget_id', id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ya.data?.id) {
    return NextResponse.json({
      ok: true,
      yaExistia: true,
      proyectoId: ya.data.id,
      nombre: ya.data.nombre,
    });
  }

  let ubicacion: string | null = null;
  const customerId = (budget as { customer_id?: string | null }).customer_id;
  if (customerId) {
    const { data: c } = await supabase.from('customers').select('direccion').eq('id', customerId).maybeSingle();
    ubicacion = (c as { direccion?: string | null } | null)?.direccion ?? null;
  }

  const subtotal = Number((budget as { subtotal?: number }).subtotal) || 0;
  const ivaPct = Number((budget as { iva_pct?: number }).iva_pct);
  const total = totalConIvaDe(subtotal, Number.isFinite(ivaPct) ? ivaPct : 16);
  const nombreDefault = nombreObraDesdePresupuesto({
    cliente: String((budget as { customer_name?: string }).customer_name ?? ''),
    numero: (budget as { numero_correlativo?: number }).numero_correlativo,
  });

  const armado = payloadObraDesdePresupuesto({
    customerId,
    entidadId: String(body.entidad_id ?? ''),
    budgetId: id,
    nombre: String(body.nombre ?? nombreDefault),
    ubicacion,
    montoUsd: total,
    status: String((budget as { status?: string }).status ?? ''),
  });
  if (!armado.ok) {
    return NextResponse.json({ error: armado.error }, { status: 400 });
  }

  const insertar = async (payload: Record<string, unknown>) =>
    supabase.from('ci_proyectos').insert(payload).select('id, nombre').single();

  let ins = await insertar(armado.payload);
  if (ins.error && /nombre_proyecto/i.test(ins.error.message)) {
    const sin = { ...armado.payload };
    delete sin.nombre_proyecto;
    ins = await insertar(sin);
  }
  if (ins.error && /tipo_proyecto/i.test(ins.error.message)) {
    const sinTipo = { ...armado.payload };
    delete sinTipo.tipo_proyecto;
    ins = await insertar(sinTipo);
  }
  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    yaExistia: false,
    proyectoId: (ins.data as { id: string }).id,
    nombre: (ins.data as { nombre?: string }).nombre ?? armado.payload.nombre,
    numeroPresupuesto: numeroPresupuesto((budget as { numero_correlativo?: number }).numero_correlativo),
  }, { status: 201 });
}
