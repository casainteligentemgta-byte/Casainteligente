import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { listarCapitulosMaestro } from '@/lib/compras/capitulosMaestro';
import { puedeProcesarEstadoProcuraWeb } from '@/lib/auth/permisos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

const SELECT_LISTADO = `
  id,ticket,estado,material_txt,cantidad,unidad,prioridad,monto_estimado_usd,
  via_rapida,es_consumible,motivo_rechazo,solicitante_nombre,observaciones,
  created_at,updated_at,
  capitulo_maestro_id,
  ci_compras_capitulos_maestro(codigo,nombre),
  ci_proyectos(nombre)
`;

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

  return NextResponse.json({
    ok: true,
    procuras: data ?? [],
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
