import { inspectLuloMdb } from '@/lib/proyectos/parsePresupuestoLuloMdb';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST: sube MDB y devuelve tablas/columnas sin escribir en BD (vista previa). */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo faltante' }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith('.mdb') && !name.endsWith('.accdb')) {
      return NextResponse.json({ error: 'Solo archivos .mdb o .accdb' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const inspection = inspectLuloMdb(buffer);
    return NextResponse.json({ success: true, ...inspection });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo leer el MDB';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
