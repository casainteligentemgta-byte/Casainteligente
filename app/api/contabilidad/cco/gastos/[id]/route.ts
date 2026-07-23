import { NextResponse } from 'next/server';
import { deleteGastoCCO, updateGastoCCO } from '@/lib/contabilidad/cco/registrosGastos';
import type { CreateGastoCcoInput } from '@/types/gastos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function bodyToInput(body: Record<string, unknown>): CreateGastoCcoInput {
  const num = (k: string) => (body[k] != null && body[k] !== '' ? Number(body[k]) : undefined);
  const str = (k: string) => (body[k] != null ? String(body[k]) : undefined);
  return {
    clase: str('clase'),
    fecha: str('fecha'),
    proveedor: str('proveedor'),
    tipo: str('tipo') ?? str('tipo_gasto_cco'),
    capitulo: str('capitulo') ?? str('capitulo_cco'),
    subcapitulo: str('subcapitulo') ?? str('subcapitulo_cco'),
    descripcion: str('descripcion'),
    contrato_vinculado: str('contrato_vinculado') ?? str('contrato_obra_id'),
    moneda: str('moneda'),
    tasa: num('tasa'),
    monto_orig: num('monto_orig'),
    monto_base_usd:
      body.monto_base_usd != null
        ? Number(body.monto_base_usd)
        : body.monto_usd != null
          ? Number(body.monto_usd)
          : undefined,
    monto_pagado: num('monto_pagado'),
    forma_pago: str('forma_pago'),
    link_factura: str('link_factura'),
    link_comprobante: str('link_comprobante'),
    estado: str('estado'),
    honorarios: num('honorarios'),
    costo_total: num('costo_total'),
    porcentaje_admin:
      body.porcentaje_admin != null
        ? Number(body.porcentaje_admin)
        : body.admin_pct != null
          ? Number(body.admin_pct)
          : undefined,
    tasa_binance: num('tasa_binance'),
    tasa_usada: str('tasa_usada'),
    porcentaje_brecha_real: num('porcentaje_brecha_real'),
    pool_asignado: num('pool_asignado'),
    avance_fisico: num('avance_fisico'),
  };
}

/** PATCH /api/contabilidad/cco/gastos/[id] */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const params = await Promise.resolve(ctx.params);
    const id = String(params.id ?? '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });

    const body = (await req.json()) as Record<string, unknown>;
    const updated = await updateGastoCCO(admin.client, id, bodyToInput(body));
    return NextResponse.json({ ok: true, row: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** DELETE /api/contabilidad/cco/gastos/[id] */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const params = await Promise.resolve(ctx.params);
    const id = String(params.id ?? '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });

    await deleteGastoCCO(admin.client, id);
    return NextResponse.json({ ok: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
