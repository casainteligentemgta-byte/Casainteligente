import { postImportarLuloPresupuesto } from '@/lib/proyectos/importarLuloPresupuesto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Ruta legacy: proyectoId en formData.
 * Preferir POST /api/proyectos/:proyectoId/presupuesto/importar-lulo
 */
export async function POST(req: Request) {
  const formData = await req.formData();
  const proyectoId = String(formData.get('proyectoId') ?? '').trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyectoId faltante' }, { status: 400 });
  }
  return postImportarLuloPresupuesto(req, proyectoId, formData);
}
