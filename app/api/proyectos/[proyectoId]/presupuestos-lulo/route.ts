import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  crearPresupuestoLulo,
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
