import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  crearFilaNominaProyecto,
  listarEmpleadosDisponiblesNomina,
  listarNominaProyecto,
  type CrearNominaProyectoInput,
} from '@/lib/proyectos/proyectoNomina';
import {
  esCategoriaNominaValida,
  type CategoriaNominaProyecto,
} from '@/lib/proyectos/rolesProyectoNomina';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

async function supabaseParaNomina() {
  return createSupabaseAdminOnlyClient() ?? (await createClient());
}

export async function GET(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const categoriaRaw = url.searchParams.get('categoria')?.trim() ?? '';
  const incluirEmpleados = url.searchParams.get('empleados') === '1';
  const categoria: CategoriaNominaProyecto | undefined = esCategoriaNominaValida(
    categoriaRaw,
  )
    ? categoriaRaw
    : undefined;

  const supabase = await supabaseParaNomina();

  try {
    const [filas, empleadosDisponibles] = await Promise.all([
      listarNominaProyecto(supabase, proyectoId, { categoria }),
      incluirEmpleados ? listarEmpleadosDisponiblesNomina(supabase, proyectoId) : null,
    ]);

    return NextResponse.json({
      proyectoId,
      filas,
      empleadosDisponibles: empleadosDisponibles ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo cargar la nómina';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  let body: CrearNominaProyectoInput;
  try {
    body = (await req.json()) as CrearNominaProyectoInput;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const supabase = await supabaseParaNomina();

  try {
    const fila = await crearFilaNominaProyecto(supabase, proyectoId, body);
    return NextResponse.json({ ok: true, fila }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo crear el registro';
    const status = msg.includes('requerido') || msg.includes('debe') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
