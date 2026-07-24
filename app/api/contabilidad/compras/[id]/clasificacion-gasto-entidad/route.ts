import { NextResponse } from 'next/server';
import {
  clasificacionGastoEntidadValida,
  parseClasificacionGastoEntidad,
} from '@/lib/contabilidad/clasificacionGastoEntidad';
import { esGastoEntidadImputacion } from '@/lib/contabilidad/imputacionCompra';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

/** PATCH { clasificacion_gasto_entidad: operacional|administrativo|servicio|null } */
export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await resolveParams(ctx.params);
    if (id.startsWith('canal-')) {
      return NextResponse.json(
        { error: 'Confirme primero la factura de Telegram en contabilidad.' },
        { status: 400 },
      );
    }

    const body = (await req.json()) as { clasificacion_gasto_entidad?: string | null };
    const raw = body.clasificacion_gasto_entidad;
    const clasificacion =
      raw === null || raw === '' || raw === undefined
        ? null
        : parseClasificacionGastoEntidad(raw);

    if (raw != null && raw !== '' && !clasificacionGastoEntidadValida(raw)) {
      return NextResponse.json(
        { error: 'Clasificación inválida. Use operacional, administrativo o servicio.' },
        { status: 400 },
      );
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { data: row, error: loadErr } = await admin.client
      .from('contabilidad_compras')
      .select('id,imputacion')
      .eq('id', id.trim())
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    if (!esGastoEntidadImputacion((row as { imputacion?: string }).imputacion)) {
      return NextResponse.json(
        { error: 'La clasificación solo aplica a compras imputadas a la entidad.' },
        { status: 400 },
      );
    }

    const { data, error } = await admin.client
      .from('contabilidad_compras')
      .update({ clasificacion_gasto_entidad: clasificacion } as never)
      .eq('id', id.trim())
      .select('id,imputacion,entidad_id,clasificacion_gasto_entidad')
      .maybeSingle();

    if (error) {
      const hint = /clasificacion_gasto_entidad/i.test(error.message)
        ? 'Ejecute la migración 222_compras_clasificacion_gasto_entidad.sql en Supabase.'
        : undefined;
      return NextResponse.json({ error: error.message, hint }, { status: 500 });
    }

    return NextResponse.json({ ok: true, compra: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo actualizar la clasificación.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
