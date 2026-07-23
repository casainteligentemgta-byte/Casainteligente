import { NextResponse } from 'next/server';
import {
  createGastoCCO,
  getGastosCCO,
  getMetricasCCO,
} from '@/lib/contabilidad/cco/registrosGastos';
import { gastoRegistroALibroFila } from '@/lib/contabilidad/cco/registrosGastos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET /api/contabilidad/cco/gastos — lista / métricas desde registros_gastos */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    if (searchParams.get('metricas') === '1') {
      const metricas = await getMetricasCCO(admin.client);
      return NextResponse.json({ ok: true, metricas });
    }

    const clase = searchParams.get('clase')?.trim() || null;
    const proveedor = searchParams.get('proveedor')?.trim() || null;
    const capitulo = searchParams.get('capitulo')?.trim() || null;
    const limitRaw = Number(searchParams.get('limit'));
    const offsetRaw = Number(searchParams.get('offset'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 10_000) : 5000;
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

    const { rows, total } = await getGastosCCO(admin.client, {
      clase,
      proveedor,
      capitulo,
      limit,
      offset,
    });

    const asLibro = searchParams.get('formato') === 'libro';
    return NextResponse.json({
      ok: true,
      total,
      rows: asLibro ? rows.map(gastoRegistroALibroFila) : rows,
      filas: asLibro ? rows.map(gastoRegistroALibroFila) : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar registros_gastos.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** POST /api/contabilidad/cco/gastos — alta en registros_gastos */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as Record<string, unknown>;
    const created = await createGastoCCO(admin.client, {
      clase: body.clase != null ? String(body.clase) : body.clase === null ? null : 'GASTO',
      fecha: body.fecha != null ? String(body.fecha) : null,
      proveedor: body.proveedor != null ? String(body.proveedor) : body.proveedor === null ? null : undefined,
      tipo:
        body.tipo != null
          ? String(body.tipo)
          : body.tipo_gasto_cco != null
            ? String(body.tipo_gasto_cco)
            : undefined,
      capitulo:
        body.capitulo != null
          ? String(body.capitulo)
          : body.capitulo_cco != null
            ? String(body.capitulo_cco)
            : undefined,
      subcapitulo:
        body.subcapitulo != null
          ? String(body.subcapitulo)
          : body.subcapitulo_cco != null
            ? String(body.subcapitulo_cco)
            : undefined,
      descripcion: body.descripcion != null ? String(body.descripcion) : undefined,
      contrato_vinculado:
        body.contrato_vinculado != null
          ? String(body.contrato_vinculado)
          : body.contrato_obra_id != null
            ? String(body.contrato_obra_id)
            : undefined,
      moneda: body.moneda != null ? String(body.moneda) : 'USD',
      tasa: body.tasa != null ? Number(body.tasa) : 1,
      monto_orig: body.monto_orig != null ? Number(body.monto_orig) : undefined,
      monto_base_usd:
        body.monto_base_usd != null
          ? Number(body.monto_base_usd)
          : body.monto_usd != null
            ? Number(body.monto_usd)
            : undefined,
      monto_pagado: body.monto_pagado != null ? Number(body.monto_pagado) : undefined,
      forma_pago: body.forma_pago != null ? String(body.forma_pago) : undefined,
      estado: body.estado != null ? String(body.estado) : 'PAGADO',
      honorarios: body.honorarios != null ? Number(body.honorarios) : undefined,
      costo_total: body.costo_total != null ? Number(body.costo_total) : undefined,
      porcentaje_admin:
        body.porcentaje_admin != null
          ? Number(body.porcentaje_admin)
          : body.admin_pct != null
            ? Number(body.admin_pct)
            : 15,
      tasa_usada: body.tasa_usada != null ? String(body.tasa_usada) : 'BCV',
      avance_fisico: body.avance_fisico != null ? Number(body.avance_fisico) : undefined,
    });

    return NextResponse.json({ ok: true, id: created.id, row: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al crear registro.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
