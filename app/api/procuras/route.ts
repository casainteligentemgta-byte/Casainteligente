import { NextResponse } from 'next/server';
import { insertarProcura } from '@/lib/procuras/registrarProcura';
import { eliminarProcurasPorIds } from '@/lib/procuras/eliminarProcuras';
import { parseEstadoProcura } from '@/lib/procuras/procuraEstados';
import { SELECT_PROCURA_SOLICITANTE } from '@/lib/procuras/solicitanteProcura';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { resolverActorWeb } from '@/lib/auth/permisos';
import { normalizarRolEmpresa } from '@/lib/auth/permisosCatalogo';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

const SELECT_LISTADO = `id,ticket,estado,material_txt,cantidad,unidad,proyecto_id,entidad_id,ubicacion_destino_id,motivo_ultimo,observaciones,created_at,updated_at,ci_proyectos(nombre),ci_entidades(nombre),${SELECT_PROCURA_SOLICITANTE}`;

/** GET listado de procuras. */
export async function GET(req: Request) {
  const authSolicitar = await requirePermisoWeb('procura.solicitar');
  if (!authSolicitar.ok) {
    const authCompra = await requirePermisoWeb('compra.registrar');
    if (!authCompra.ok) {
      if (authSolicitar.response.status === 401) return authSolicitar.response;
      if (authCompra.response.status === 401) return authCompra.response;

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
      }

      const actor = await resolverActorWeb(supabase, user.id, user.email);
      const esSoloLectura = actor.rolesEmpresa.some(
        (rol) => normalizarRolEmpresa(rol) === 'solo_lectura',
      );
      if (!esSoloLectura) {
        return NextResponse.json(
          { error: 'No autorizado. Permisos insuficientes para consultar procuras.' },
          { status: 403 },
        );
      }
    }
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const { searchParams } = new URL(req.url);
    const estado = parseEstadoProcura(searchParams.get('estado'));
    const proyectoId = searchParams.get('proyecto_id')?.trim() || null;
    const entidadId = searchParams.get('entidad_id')?.trim() || null;
    const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

    let q = admin.client
      .from('ci_procuras')
      .select(SELECT_LISTADO)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (estado) q = q.eq('estado', estado);
    if (proyectoId) q = q.eq('proyecto_id', proyectoId);
    if (entidadId) q = q.eq('entidad_id', entidadId);

    let { data, error } = await q;

    if (error && /solicitante_nombre|ci_procuras_solicitante/i.test(error.message)) {
      const fallbackSelect =
        'id,ticket,estado,material_txt,cantidad,unidad,proyecto_id,entidad_id,ubicacion_destino_id,motivo_ultimo,observaciones,solicitante_empleado_id,solicitante_telegram_chat_id,created_at,updated_at,ci_proyectos(nombre),ci_entidades(nombre)';
      let q2 = admin.client.from('ci_procuras').select(fallbackSelect).order('updated_at', { ascending: false }).limit(limit);
      if (estado) q2 = q2.eq('estado', estado);
      if (proyectoId) q2 = q2.eq('proyecto_id', proyectoId);
      if (entidadId) q2 = q2.eq('entidad_id', entidadId);
      ({ data, error } = await q2);
    }

    if (error) {
      const hint = /ci_procuras/i.test(error.message)
        ? 'Ejecute las migraciones 224 y 225 en Supabase.'
        : undefined;
      return NextResponse.json({ error: error.message, hint }, { status: 500 });
    }

    return NextResponse.json({ ok: true, procuras: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al listar procuras';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — Nueva procura. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      material_id?: string | null;
      material_txt?: string;
      cantidad?: number | string;
      unidad?: string;
      proyecto_id?: string | null;
      entidad_id?: string | null;
      ubicacion_destino_id?: string | null;
      estado?: string;
      observaciones?: string | null;
      solicitante_empleado_id?: string | null;
      solicitante_nombre?: string | null;
      solicitante_telegram_chat_id?: number | string | null;
      asignado_telegram_chat_id?: number | string | null;
    };

    const auth = await requirePermisoWeb('procura.solicitar', {
      proyectoId: body.proyecto_id,
      entidadId: body.entidad_id,
    });
    if (!auth.ok) return auth.response;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const solicitanteChat = Number(body.solicitante_telegram_chat_id);
    const { data, error } = await insertarProcura(
      admin.client,
      {
        material_id: body.material_id?.trim() || null,
        material_txt: String(body.material_txt ?? ''),
        cantidad: Number(body.cantidad),
        unidad: body.unidad,
        proyecto_id: body.proyecto_id,
        entidad_id: body.entidad_id,
        ubicacion_destino_id: body.ubicacion_destino_id,
        estado: body.estado,
        observaciones: body.observaciones,
        solicitante_empleado_id: body.solicitante_empleado_id,
        solicitante_nombre: body.solicitante_nombre,
        solicitante_telegram_chat_id:
          Number.isFinite(solicitanteChat) && solicitanteChat > 0 ? Math.trunc(solicitanteChat) : null,
        asignado_telegram_chat_id: body.asignado_telegram_chat_id,
      },
      { origen: 'web' },
    );

    if (error) {
      const hint = /solicitante_nombre|ci_procuras/i.test(error.message)
        ? 'Ejecute la migración 225_ci_procuras_solicitante_nombre.sql en Supabase.'
        : undefined;
      const status = error.message.includes('Indique') ? 400 : 500;
      return NextResponse.json({ error: error.message, hint }, { status });
    }

    return NextResponse.json({ ok: true, procura: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al crear procura';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — Elimina procuras seleccionadas (sin compra ni recepción vinculada). */
export async function DELETE(req: Request) {
  try {
    const auth = await requirePermisoWeb('procura.aprobar');
    if (!auth.ok) return auth.response;

    const body = (await req.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id).trim()).filter(Boolean) : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'Indique al menos un id de procura.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await eliminarProcurasPorIds(admin.client, ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron eliminar las procuras';
    const status = /Indique|No se pueden|no existen|vinculadas|recepciones/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
