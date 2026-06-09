import { NextResponse } from 'next/server';
import { parseEstadoProcura } from '@/lib/procuras/procuraEstados';
import { normalizarUnidadProcura } from '@/lib/procuras/unidadesProcura';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET listado de procuras. */
export async function GET(req: Request) {
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
      .select(
        'id,ticket,estado,material_txt,cantidad,unidad,proyecto_id,entidad_id,ubicacion_destino_id,motivo_ultimo,observaciones,created_at,updated_at,ci_proyectos(nombre),ci_entidades(nombre)',
      )
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (estado) q = q.eq('estado', estado);
    if (proyectoId) q = q.eq('proyecto_id', proyectoId);
    if (entidadId) q = q.eq('entidad_id', entidadId);

    const { data, error } = await q;
    if (error) {
      const hint = /ci_procuras/i.test(error.message)
        ? 'Ejecute la migración 224_ci_procuras_lote.sql en Supabase.'
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
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const body = (await req.json()) as {
      material_txt?: string;
      cantidad?: number | string;
      unidad?: string;
      proyecto_id?: string | null;
      entidad_id?: string | null;
      ubicacion_destino_id?: string | null;
      estado?: string;
      observaciones?: string | null;
      asignado_telegram_chat_id?: number | string | null;
      solicitante_telegram_chat_id?: number | string | null;
    };

    const materialTxt = String(body.material_txt ?? '').trim();
    if (!materialTxt) {
      return NextResponse.json({ error: 'Indique la descripción del material.' }, { status: 400 });
    }

    const cantidad = Number(body.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json({ error: 'Cantidad inválida.' }, { status: 400 });
    }

    const estado = parseEstadoProcura(body.estado) ?? 'solicitada';

    const row: Record<string, unknown> = {
      material_txt: materialTxt.slice(0, 500),
      cantidad,
      unidad: normalizarUnidadProcura(body.unidad),
      estado,
      observaciones: body.observaciones?.trim()?.slice(0, 2000) || null,
    };

    const proyectoId = body.proyecto_id?.trim();
    const entidadId = body.entidad_id?.trim();
    if (proyectoId) row.proyecto_id = proyectoId;
    if (entidadId) row.entidad_id = entidadId;
    if (body.ubicacion_destino_id?.trim()) {
      row.ubicacion_destino_id = body.ubicacion_destino_id.trim();
    }

    const asignadoChat = Number(body.asignado_telegram_chat_id);
    if (Number.isFinite(asignadoChat) && asignadoChat > 0) {
      row.asignado_telegram_chat_id = Math.trunc(asignadoChat);
    }
    const solicitanteChat = Number(body.solicitante_telegram_chat_id);
    if (Number.isFinite(solicitanteChat) && solicitanteChat > 0) {
      row.solicitante_telegram_chat_id = Math.trunc(solicitanteChat);
    }

    if (!proyectoId && !entidadId) {
      return NextResponse.json(
        { error: 'Indique proyecto u entidad para la procura.' },
        { status: 400 },
      );
    }

    const { data, error } = await admin.client
      .from('ci_procuras')
      .insert(row as never)
      .select(
        'id,ticket,estado,material_txt,cantidad,unidad,proyecto_id,entidad_id,created_at,updated_at',
      )
      .single();

    if (error) {
      const hint = /ci_procuras/i.test(error.message)
        ? 'Ejecute la migración 224_ci_procuras_lote.sql en Supabase.'
        : undefined;
      return NextResponse.json({ error: error.message, hint }, { status: 500 });
    }

    return NextResponse.json({ ok: true, procura: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al crear procura';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
