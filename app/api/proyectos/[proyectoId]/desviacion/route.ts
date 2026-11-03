import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { UMBRAL_DESVIACION_DEFAULT_PCT } from '@/lib/proyectos/desviacion/calcularDesviacionPresupuestaria';
import { cargarDesviacionProyecto } from '@/lib/proyectos/desviacion/cargarDesviacionProyecto';
import { esMigracionJornalesPendiente } from '@/lib/proyectos/jornales/calcularJornalesSemana';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

export async function GET(_req: Request, { params }: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['equipo.gestionar', 'cco.ver']);
  if (!acceso.ok) return acceso.response;

  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  try {
    const payload = await cargarDesviacionProyecto(acceso.supabase, proyectoId);
    return NextResponse.json(payload);
  } catch (err) {
    const msg = formatErrorMessage(err);
    const status = /no encontrado/i.test(msg)
      ? 404
      : /migración 382|migración 389/i.test(msg)
        ? 503
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['equipo.gestionar', 'cco.editar']);
  if (!acceso.ok) return acceso.response;

  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  let body: {
    umbral_pct?: number;
    umbral_materiales_pct?: number;
    umbral_mano_obra_pct?: number;
    limite_jornadas_instalacion?: number | null;
    especialidad_limite?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const umbral = Number(body.umbral_pct);
  const row = {
    proyecto_id: proyectoId,
    umbral_desviacion_pct:
      Number.isFinite(umbral) && umbral >= 0 ? umbral : UMBRAL_DESVIACION_DEFAULT_PCT,
    umbral_materiales_pct:
      body.umbral_materiales_pct != null && Number.isFinite(Number(body.umbral_materiales_pct))
        ? Number(body.umbral_materiales_pct)
        : Number.isFinite(umbral) && umbral >= 0
          ? umbral
          : UMBRAL_DESVIACION_DEFAULT_PCT,
    umbral_mano_obra_pct:
      body.umbral_mano_obra_pct != null && Number.isFinite(Number(body.umbral_mano_obra_pct))
        ? Number(body.umbral_mano_obra_pct)
        : Number.isFinite(umbral) && umbral >= 0
          ? umbral
          : UMBRAL_DESVIACION_DEFAULT_PCT,
    limite_jornadas_instalacion:
      body.limite_jornadas_instalacion == null
        ? null
        : Number(body.limite_jornadas_instalacion),
    especialidad_limite: body.especialidad_limite?.trim() || 'Instalador CCTV',
    updated_at: new Date().toISOString(),
  };

  const { error } = await acceso.supabase
    .from('ci_proyecto_desviacion_config')
    .upsert(row, { onConflict: 'proyecto_id' });
  if (error) {
    const msg = error.message;
    if (esMigracionJornalesPendiente(msg)) {
      return NextResponse.json(
        { error: 'Aplique la migración 382_ci_jornales_obra_y_desviacion.sql en Supabase.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const payload = await cargarDesviacionProyecto(acceso.supabase, proyectoId);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: formatErrorMessage(err) }, { status: 500 });
  }
}
