import { NextResponse } from 'next/server';
import {
  actualizarConductor,
  agregarDocumentoConductor,
  eliminarConductor,
  eliminarDocumentoConductor,
  obtenerConductor,
} from '@/lib/flota/conductores';
import { esUuid } from '@/lib/flota/utils';
import {
  actualizarVehiculo,
  eliminarVehiculo,
  requireAccesoFlota,
  respuestaMigracionPendiente,
  subirArchivoFlota,
} from '@/lib/flota/acceso';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(ctx: RouteCtx): Promise<string> {
  const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
  return params.id?.trim() ?? '';
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const id = await resolveId(ctx);
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  try {
    const { conductor, migracionPendiente } = await obtenerConductor(auth.supabase, id);
    if (migracionPendiente) return respuestaMigracionPendiente({ conductor: null });
    if (!conductor) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, conductor });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cargar conductor' },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request, ctx: RouteCtx) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const id = await resolveId(ctx);
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    if (body.recurso === 'vehiculo') {
      const vehiculo = await actualizarVehiculo(auth.supabase, id, body);
      return NextResponse.json({ ok: true, vehiculo });
    }

    if (body.accion === 'agregar_documento') {
      const docBody = { ...(body.documento as Record<string, unknown> | undefined), ...body };
      if (typeof body.archivo_base64 === 'string' && body.archivo_base64.trim()) {
        const buf = Buffer.from(String(body.archivo_base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
        const nombre = String(body.archivo_nombre ?? 'documento').replace(/[^\w.\-]+/g, '_');
        const mime = String(body.archivo_mime ?? 'application/octet-stream');
        docBody.url = await subirArchivoFlota(auth.supabase, {
          path: `conductores/${id}/${Date.now()}-${nombre}`,
          buffer: buf,
          contentType: mime,
        });
      }
      const documento = await agregarDocumentoConductor(auth.supabase, id, docBody);
      return NextResponse.json({ ok: true, documento });
    }

    if (body.accion === 'eliminar_documento') {
      const docId = String(body.documento_id ?? '');
      if (!esUuid(docId)) return NextResponse.json({ error: 'documento_id inválido' }, { status: 400 });
      await eliminarDocumentoConductor(auth.supabase, docId);
      return NextResponse.json({ ok: true });
    }

    const conductor = await actualizarConductor(id, body);
    return NextResponse.json({ ok: true, conductor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al actualizar';
    const status = /requerido|inválid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const id = await resolveId(ctx);
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  const url = new URL(_req.url);
  try {
    if (url.searchParams.get('recurso') === 'vehiculo') {
      await eliminarVehiculo(auth.supabase, id);
      return NextResponse.json({ ok: true });
    }
    await eliminarConductor(auth.supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al eliminar' },
      { status: 500 },
    );
  }
}
