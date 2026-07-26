import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  crearPresupuestoLulo,
  eliminarPresupuestoLuloAdicional,
  listarPresupuestosLulo,
} from '@/lib/proyectos/presupuestosLulo';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { proyectoId: string } };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const proyectoId = params.proyectoId?.trim() ?? '';
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
    }
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const presupuestos = await listarPresupuestosLulo(supabase, proyectoId);
    return NextResponse.json({ presupuestos });
  } catch (err) {
    return NextResponse.json({ error: formatErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const proyectoId = params.proyectoId?.trim() ?? '';
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
    }
    const body = (await req.json()) as {
      codigo_obr?: string;
      codigoObr?: string;
      nombre?: string;
      es_principal?: boolean;
      notas?: string;
    };
    const codigoObr = String(body.codigo_obr ?? body.codigoObr ?? '').trim();
    const nombre = String(body.nombre ?? '').trim();
    if (!codigoObr || !nombre) {
      return NextResponse.json(
        { error: 'codigo_obr y nombre son obligatorios.' },
        { status: 400 },
      );
    }
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const row = await crearPresupuestoLulo(supabase, {
      proyectoId,
      codigoObr,
      nombre,
      esPrincipal: body.es_principal ?? false,
      notas: body.notas ?? null,
    });
    return NextResponse.json({ presupuesto: row }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: formatErrorMessage(err) }, { status: 500 });
  }
}

/** Borra una obra adicional Lulo (`?id=` o body `{ id }`). No permite borrar la principal. */
export async function DELETE(req: Request, { params }: RouteContext) {
  try {
    const proyectoId = params.proyectoId?.trim() ?? '';
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
    }

    const url = new URL(req.url);
    let presupuestoId = url.searchParams.get('id')?.trim() ?? '';
    if (!presupuestoId) {
      try {
        const body = (await req.json()) as { id?: string; presupuesto_id?: string };
        presupuestoId = String(body.id ?? body.presupuesto_id ?? '').trim();
      } catch {
        presupuestoId = '';
      }
    }
    if (!presupuestoId || !UUID_RE.test(presupuestoId)) {
      return NextResponse.json(
        { error: 'id de presupuesto Lulo inválido o ausente.' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    await eliminarPresupuestoLuloAdicional(supabase, proyectoId, presupuestoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = formatErrorMessage(err);
    const status = /principal|no encontrado/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
