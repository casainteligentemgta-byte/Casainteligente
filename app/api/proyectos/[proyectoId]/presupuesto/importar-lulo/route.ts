import { postImportarLuloPresupuesto } from '@/lib/proyectos/importarLuloPresupuesto';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** MDB/ACCDB de Lulo pueden ser grandes */
export const maxDuration = 120;

type RouteContext = { params: { proyectoId: string } };

/**
 * POST /api/proyectos/:proyectoId/presupuesto/importar-lulo
 * multipart: file, reemplazar?, importarGastos?, tableName?, customMapping?
 */
export async function POST(req: Request, { params }: RouteContext) {
  const proyectoId = params.proyectoId?.trim();
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }
  return postImportarLuloPresupuesto(req, proyectoId);
}
