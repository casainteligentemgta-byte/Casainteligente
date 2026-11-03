import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import {
  asignarEntidadAClientes,
  listarClientesSinEntidad,
} from '@/lib/clientes/clienteEntidades';
import { esAdminGlobalRoles, esUuid } from '@/lib/clientes/entidadActiva';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function soloAdmin(rolesEmpresa: readonly string[]) {
  if (esAdminGlobalRoles(rolesEmpresa)) return null;
  return NextResponse.json(
    { error: 'Solo un administrador puede ver y asignar clientes sin empresa.' },
    { status: 403 },
  );
}

/** GET: clientes que todavía no están en ninguna empresa (los 17 de producción, etc.). */
export async function GET() {
  const acceso = await requirePermisoWeb('clientes.ver');
  if (!acceso.ok) return acceso.response;
  const denegado = soloAdmin(acceso.actor.rolesEmpresa);
  if (denegado) return denegado;

  const r = await listarClientesSinEntidad(acceso.supabase);
  if (r.error) {
    return NextResponse.json(
      { error: r.error, hint: r.migracionPendiente ? '394_ci_cliente_entidades.sql' : undefined },
      { status: r.migracionPendiente ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, cantidad: r.filas.length, clientes: r.filas });
}

/** POST: asigna una empresa a esos clientes (o a una lista). */
export async function POST(req: Request) {
  const acceso = await requirePermisoWeb('clientes.editar');
  if (!acceso.ok) return acceso.response;
  const denegado = soloAdmin(acceso.actor.rolesEmpresa);
  if (denegado) return denegado;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const entidadId = String(body.entidad_id ?? '').trim();
  if (!esUuid(entidadId)) {
    return NextResponse.json({ error: 'Elija una empresa.' }, { status: 400 });
  }

  let ids = Array.isArray(body.customer_ids)
    ? body.customer_ids.map((x) => String(x ?? '').trim()).filter(Boolean)
    : [];
  if (!ids.length) {
    const pendientes = await listarClientesSinEntidad(acceso.supabase);
    if (pendientes.error) {
      return NextResponse.json(
        {
          error: pendientes.error,
          hint: pendientes.migracionPendiente ? '394_ci_cliente_entidades.sql' : undefined,
        },
        { status: pendientes.migracionPendiente ? 409 : 400 },
      );
    }
    ids = pendientes.ids;
  }

  const r = await asignarEntidadAClientes(acceso.supabase, ids, entidadId);
  if (r.error) {
    return NextResponse.json(
      { error: r.error, hint: r.migracionPendiente ? '394_ci_cliente_entidades.sql' : undefined },
      { status: r.migracionPendiente ? 409 : 400 },
    );
  }
  return NextResponse.json({ ok: true, vinculados: r.vinculados });
}
