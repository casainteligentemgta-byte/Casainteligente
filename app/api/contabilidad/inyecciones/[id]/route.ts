import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';
import { registrarEventoAuditoriaCco } from '@/lib/contabilidad/cco/registrarAuditoria';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DELETE — borra una inyección de capital (ingreso de dinero a la obra).
 * Exige permiso cco.editar. El saldo de fondos de la obra lo recalcula el trigger
 * tr_ci_inyecciones_recalcular_fondos (migración 359). Queda registro en cco_auditoria_eventos.
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const acceso = await requireCcoAcceso('editar');
  if (!acceso.ok) return acceso.response;

  const params = await Promise.resolve(ctx.params);
  const id = String(params?.id ?? '').trim();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Inyección inválida.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const db: SupabaseClient = admin.client;

  const { data: fila, error: errLeer } = await db
    .from('ci_inyecciones_capital')
    .select('id, proyecto_id, origen_fondo, moneda_recibida, monto_recibido, monto_usd, monto_ves, fecha_ingreso, creado_por, soporte_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (errLeer) {
    return NextResponse.json({ error: errLeer.message }, { status: 500 });
  }
  if (!fila) {
    return NextResponse.json({ error: 'La inyección ya no existe.' }, { status: 404 });
  }

  const { error: errBorrar } = await db.from('ci_inyecciones_capital').delete().eq('id', id);
  if (errBorrar) {
    return NextResponse.json({ error: errBorrar.message }, { status: 400 });
  }

  const montoUsd = Number(fila.monto_usd ?? 0);
  await registrarEventoAuditoriaCco(db, {
    proyecto_id: fila.proyecto_id ?? null,
    accion: 'ELIMINACION INGRESO',
    detalle:
      `Borró inyección de capital: «${fila.origen_fondo ?? ''}» · ` +
      `${fila.monto_recibido} ${fila.moneda_recibida} ($${montoUsd.toFixed(2)}) · ` +
      `ingreso ${fila.fecha_ingreso ?? 's/f'} · registrada por ${fila.creado_por ?? '—'}`,
    actor: acceso.actor.email ?? null,
    metadata: { inyeccion: fila },
  });

  return NextResponse.json({ ok: true, id });
}
