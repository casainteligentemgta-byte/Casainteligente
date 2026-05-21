import { postImportarLuloPresupuesto } from '@/lib/proyectos/importarLuloPresupuesto';
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
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyectoId requerido en la URL' }, { status: 400 });
  }
  return postImportarLuloPresupuesto(req, proyectoId);
}
