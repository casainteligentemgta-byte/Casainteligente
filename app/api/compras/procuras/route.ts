import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { listarCapitulosMaestro } from '@/lib/compras/capitulosMaestro';
import { puedeProcesarEstadoProcuraWeb } from '@/lib/auth/permisos';
import { eliminarProcurasPorIds } from '@/lib/procuras/eliminarProcuras';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

const SELECT_LISTADO = `
  id,ticket,estado,material_txt,material_id,cantidad,unidad,prioridad,monto_estimado_usd,
  via_rapida,es_consumible,motivo_rechazo,solicitante_nombre,observaciones,
  proyecto_id,entidad_id,purchase_invoice_id,
  created_at,updated_at,
  capitulo_maestro_id,
  ci_compras_capitulos_maestro(codigo,nombre),
  ci_proyectos(nombre),
  ci_entidades(nombre),
  contabilidad_compras(id,invoice_number,document_storage_path)
`;

type CompraProcuraVinculo = {
  id: string;
  invoice_number?: string | null;
  document_storage_path?: string | null;
};

function primeraCompraVinculada(
  raw: CompraProcuraVinculo | CompraProcuraVinculo[] | null | undefined,
): CompraProcuraVinculo | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  const id = String(row?.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    invoice_number: row.invoice_number ?? null,
    document_storage_path: row.document_storage_path ?? null,
  };
}

async function enriquecerProcurasConCompra(
  client: SupabaseClient,
  filas: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const sinCompra = filas.filter((p) => {
    const vinculo = primeraCompraVinculada(
      p.contabilidad_compras as CompraProcuraVinculo | CompraProcuraVinculo[] | null,
    );
    return !vinculo && String(p.purchase_invoice_id ?? '').trim();
  });

  const piIds = Array.from(
    new Set(
      sinCompra
        .map((p) => String(p.purchase_invoice_id ?? '').trim())
        .filter(Boolean),
    ),
  ).slice(0, 200);

  const porPi = new Map<string, CompraProcuraVinculo>();
  if (piIds.length) {
    const { data: comprasPi } = await client
      .from('contabilidad_compras')
      .select('id,invoice_number,document_storage_path,purchase_invoice_id')
      .in('purchase_invoice_id', piIds);
    for (const row of comprasPi ?? []) {
      const pi = String(row.purchase_invoice_id ?? '').trim();
      if (pi) porPi.set(pi, primeraCompraVinculada(row as CompraProcuraVinculo)!);
    }
  }

  return filas.map((p) => {
    const vinculo =
      primeraCompraVinculada(
        p.contabilidad_compras as CompraProcuraVinculo | CompraProcuraVinculo[] | null,
      ) ??
      porPi.get(String(p.purchase_invoice_id ?? '').trim()) ??
      null;
    const { contabilidad_compras: _omit, ...rest } = p;
    return { ...rest, contabilidad_compra: vinculo };
  });
}

/** GET — Procuras del departamento de compras (con capítulo). */
export async function GET(req: Request) {
  const auth = await requirePermisoWeb('procura.aprobar');
  if (!auth.ok) {
    const read = await requirePermisoWeb('procura.solicitar');
    if (!read.ok) return auth.response;
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado')?.trim() || null;
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 300);

  let q = admin.client
    .from('ci_procuras')
    .select(SELECT_LISTADO)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;

  if (error) {
    const hint = /capitulo_maestro|ci_compras_capitulos/i.test(error.message)
      ? 'Ejecute migración 230_ci_compras_departamento_telegram.sql'
      : undefined;
    return NextResponse.json({ error: error.message, hint }, { status: 500 });
  }

  const capitulos = await listarCapitulosMaestro(admin.client);
  const procuras = await enriquecerProcurasConCompra(
    admin.client,
    (data ?? []) as Record<string, unknown>[],
  );

  return NextResponse.json({
    ok: true,
    procuras,
    capitulos,
  });
}

/** PATCH — Aprobador web: cambiar estado (vía larga). */
export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    ids?: string[];
    nuevoEstado?: string;
    motivo?: string | null;
  };

  const nuevoEstado = String(body.nuevoEstado ?? '').trim().toLowerCase();
  if (nuevoEstado === 'en_compra') {
    return NextResponse.json(
      {
        error:
          '«Comprada» solo aplica al vincular factura de compra. Use /facturas en Telegram.',
      },
      { status: 400 },
    );
  }

  const perm =
    nuevoEstado === 'en_compra'
      ? ('procura.ejecutar_compra' as const)
      : ('procura.aprobar' as const);

  const auth = await requirePermisoWeb(perm);
  if (!auth.ok) return auth.response;

  if (!puedeProcesarEstadoProcuraWeb(auth.actor, nuevoEstado)) {
    return NextResponse.json({ error: 'Sin permiso para este estado.' }, { status: 403 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
  if (!ids.length) {
    return NextResponse.json({ error: 'Indique ids.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.client.rpc(
    'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
    {
      p_ids: ids,
      p_nuevo_estado: nuevoEstado,
      p_motivo: body.motivo?.trim() || null,
    } as never,
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, procuras: data ?? [] });
}

/** DELETE — Elimina procuras (desvincula factura contable sin borrarla). */
export async function DELETE(req: Request) {
  const auth = await requirePermisoWeb('procura.aprobar');
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'Indique ids.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await eliminarProcurasPorIds(admin.client, ids, { desvincularVinculos: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron eliminar las procuras';
    const status = /Indique|No se pueden|no existen|material ya recibido/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
