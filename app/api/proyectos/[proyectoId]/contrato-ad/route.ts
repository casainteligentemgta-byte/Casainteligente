import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ESTADO_CONTRATO_EXITOSO,
  obtenerContratoAdProyecto,
  proyectoTieneContratoAdExitoso,
  registrarContratoAdministracionDelegada,
} from '@/lib/proyectos/contratoAdministracionDelegada';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

type RouteCtx = { params: { proyectoId: string } };

export async function GET(_req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: 'ID de proyecto inválido' }, { status: 400 });
  }

  const supabase = await createClient();
  const [autorizado, contrato] = await Promise.all([
    proyectoTieneContratoAdExitoso(supabase, proyectoId),
    obtenerContratoAdProyecto(supabase, proyectoId),
  ]);

  return NextResponse.json({
    autorizado,
    contrato,
    requiereAd: !autorizado,
  });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: 'ID de proyecto inválido' }, { status: 400 });
  }

  let body: { entidad_ejecutora_id?: string; honorarios_admin_pct?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const entidadId = body.entidad_ejecutora_id?.trim() ?? '';
  const pct = Number(body.honorarios_admin_pct);
  if (!entidadId) {
    return NextResponse.json({ error: 'Seleccione la entidad ejecutora.' }, { status: 400 });
  }
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json(
      { error: 'Indique un porcentaje de honorarios entre 0 y 100.' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const { id } = await registrarContratoAdministracionDelegada(supabase, {
      proyectoId,
      entidadEjecutoraId: entidadId,
      honorariosAdminPct: pct,
      createdBy: user?.id ?? null,
    });

    return NextResponse.json({
      ok: true,
      id,
      estado: ESTADO_CONTRATO_EXITOSO,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo registrar el contrato AD.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
