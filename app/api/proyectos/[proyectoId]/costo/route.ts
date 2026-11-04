import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { cargarCostoObra, esMigracionCostoObraPendiente } from '@/lib/proyectos/costoObra/cargarCostoObra';
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
    const payload = await cargarCostoObra(acceso.supabase, proyectoId);
    return NextResponse.json(payload);
  } catch (err) {
    const msg = formatErrorMessage(err);
    const status = /no encontrado/i.test(msg)
      ? 404
      : esMigracionCostoObraPendiente(msg) || /migración 395/i.test(msg)
        ? 503
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
