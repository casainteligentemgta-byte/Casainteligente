import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listarRolesEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import {
  cargarEntidadesCliente,
  desvincularClienteEntidad,
  entidadesIdsDesdeRoles,
  vincularClienteEntidad,
} from '@/lib/clientes/clienteEntidades';
import { esAdminGlobalRoles, esUuid } from '@/lib/clientes/entidadActiva';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function idDe(context: { params: { id: string } }): string {
  return decodeURIComponent(context.params?.id ?? '').trim();
}

async function entidadesPermitidas(
  session: SupabaseClient,
  userId: string,
  rolesEmpresa: readonly string[],
): Promise<{ esAdmin: boolean; entidadIds: string[] }> {
  const esAdmin = esAdminGlobalRoles(rolesEmpresa);
  let roles = await listarRolesEmpresaUsuario(session, userId);
  if (roles.length === 0) {
    const admin = createSupabaseAdminOnlyClient();
    if (admin) roles = await listarRolesEmpresaUsuario(admin, userId);
  }
  return { esAdmin, entidadIds: entidadesIdsDesdeRoles(roles) };
}

export async function GET(_req: Request, context: { params: { id: string } }) {
  const acceso = await requirePermisoWeb('clientes.ver');
  if (!acceso.ok) return acceso.response;

  const id = idDe(context);
  if (!esUuid(id)) {
    return NextResponse.json({ error: 'Identificador no válido.' }, { status: 400 });
  }

  const r = await cargarEntidadesCliente(acceso.supabase, id);
  if (r.error) {
    return NextResponse.json(
      { error: r.error, hint: r.migracionPendiente ? '394_ci_cliente_entidades.sql' : undefined },
      { status: r.migracionPendiente ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, entidades: r.vinculos });
}

export async function POST(req: Request, context: { params: { id: string } }) {
  const acceso = await requirePermisoWeb('clientes.editar');
  if (!acceso.ok) return acceso.response;

  const id = idDe(context);
  if (!esUuid(id)) {
    return NextResponse.json({ error: 'Identificador no válido.' }, { status: 400 });
  }

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

  const perm = await entidadesPermitidas(acceso.supabase, acceso.userId, acceso.actor.rolesEmpresa);
  if (!perm.esAdmin && !perm.entidadIds.includes(entidadId)) {
    return NextResponse.json(
      { error: 'Solo puede vincular el cliente a una empresa donde usted trabaja.' },
      { status: 403 },
    );
  }

  const r = await vincularClienteEntidad(acceso.supabase, id, entidadId);
  if (r.error) {
    return NextResponse.json(
      { error: r.error, hint: r.migracionPendiente ? '394_ci_cliente_entidades.sql' : undefined },
      { status: r.migracionPendiente ? 409 : 400 },
    );
  }
  return NextResponse.json({ ok: true, ya_estaba: r.yaEstaba });
}

export async function DELETE(req: Request, context: { params: { id: string } }) {
  const acceso = await requirePermisoWeb('clientes.editar');
  if (!acceso.ok) return acceso.response;

  const id = idDe(context);
  if (!esUuid(id)) {
    return NextResponse.json({ error: 'Identificador no válido.' }, { status: 400 });
  }

  const url = new URL(req.url);
  let entidadId = url.searchParams.get('entidad_id')?.trim() ?? '';
  if (!esUuid(entidadId)) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      entidadId = String(body.entidad_id ?? '').trim();
    } catch {
      entidadId = '';
    }
  }
  if (!esUuid(entidadId)) {
    return NextResponse.json({ error: 'Indique la empresa a quitar.' }, { status: 400 });
  }

  const perm = await entidadesPermitidas(acceso.supabase, acceso.userId, acceso.actor.rolesEmpresa);
  if (!perm.esAdmin && !perm.entidadIds.includes(entidadId)) {
    return NextResponse.json(
      { error: 'Solo puede quitar el cliente de una empresa donde usted trabaja.' },
      { status: 403 },
    );
  }

  const r = await desvincularClienteEntidad(acceso.supabase, id, entidadId);
  if (r.error) {
    return NextResponse.json(
      { error: r.error, hint: r.migracionPendiente ? '394_ci_cliente_entidades.sql' : undefined },
      { status: r.migracionPendiente ? 409 : 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
