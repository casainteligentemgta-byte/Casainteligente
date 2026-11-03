import { NextResponse } from 'next/server';
import { listarRolesEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import {
  entidadActivaDesdeRoles,
  esAdminGlobalRoles,
} from '@/lib/clientes/entidadActiva';
import { guardarClienteEnDb, payloadClientePermitido } from '@/lib/clientes/guardarCliente';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/clientes
 * Alta de cliente con la entidad activa del usuario (RLS + clientes.editar).
 * Usa el cliente de sesión (no service_role) para no romper Telegram ni RPCs DEFINER.
 */
export async function POST(req: Request) {
  const acceso = await requirePermisoWeb('clientes.editar');
  if (!acceso.ok) return acceso.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const payload = payloadClientePermitido(body);
  if (!String(payload.nombre ?? '').trim() && !String(payload.razon_social ?? '').trim()) {
    return NextResponse.json({ error: 'Indique el nombre o la razón social.' }, { status: 400 });
  }
  if (!payload.status) payload.status = 'activo';

  let roles = await listarRolesEmpresaUsuario(acceso.supabase, acceso.userId);
  if (roles.length === 0) {
    try {
      const { createSupabaseAdminOnlyClient } = await import('@/lib/supabase/adminOnlyClient');
      const admin = createSupabaseAdminOnlyClient();
      if (admin) roles = await listarRolesEmpresaUsuario(admin, acceso.userId);
    } catch {
      /* sin service role: se queda vacío */
    }
  }
  const entidadId = entidadActivaDesdeRoles(roles);
  if (entidadId) {
    payload.entidad_id = entidadId;
  } else if (!esAdminGlobalRoles(acceso.actor.rolesEmpresa)) {
    return NextResponse.json(
      {
        error:
          'No hay una entidad asignada a su usuario. Pida a un administrador que le dé un rol en una entidad.',
      },
      { status: 400 },
    );
  }

  const result = await guardarClienteEnDb(acceso.supabase, payload, null);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (!result.id) {
    return NextResponse.json({ error: 'Se guardó el cliente pero no se obtuvo el identificador.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
