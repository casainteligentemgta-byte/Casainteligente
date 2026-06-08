import { NextResponse } from 'next/server';
import {
  IMPUTACION_ENTIDAD,
  IMPUTACION_OBRA,
  parseImputacionCompra,
} from '@/lib/contabilidad/imputacionCompra';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

/** PATCH { imputacion: 'obra' | 'entidad' } — excluye o incluye la compra en valuación AD. */
export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await resolveParams(ctx.params);
    if (id.startsWith('canal-')) {
      return NextResponse.json(
        { error: 'Confirme primero la factura de Telegram en contabilidad.' },
        { status: 400 },
      );
    }

    const body = (await req.json()) as { imputacion?: string };
    const imputacion = parseImputacionCompra(body.imputacion);

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const patch: Record<string, unknown> = { imputacion };

    if (imputacion === IMPUTACION_ENTIDAD) {
      patch.proyecto_id = null;
      patch.valuacion_delegada_id = null;
    }

    const { data, error } = await admin.client
      .from('contabilidad_compras')
      .update(patch as never)
      .eq('id', id.trim())
      .select('id,imputacion,proyecto_id,entidad_id,valuacion_delegada_id')
      .maybeSingle();

    type CompraImputacionRow = {
      id: string;
      imputacion: string | null;
      proyecto_id: string | null;
      entidad_id: string | null;
      valuacion_delegada_id: string | null;
    };

    const row = data as CompraImputacionRow | null;

    if (error) {
      const hint = /imputacion/i.test(error.message)
        ? 'Ejecuta la migración 219_compras_imputacion_entidad.sql en Supabase.'
        : undefined;
      return NextResponse.json({ error: error.message, hint }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    if (imputacion === IMPUTACION_OBRA && !row.proyecto_id) {
      return NextResponse.json(
        {
          error:
            'Para imputar a obra asigne un proyecto (Reubicar compra) antes de quitar el flag de entidad.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, compra: row });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo actualizar la imputación.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
