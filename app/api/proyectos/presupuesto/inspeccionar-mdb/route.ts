import { formatMdbReadError, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import { inspectLuloMdb } from '@/lib/proyectos/parsePresupuestoLuloMdb';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const buffer = toMdbNodeBuffer(await file.arrayBuffer());
    const inspection = inspectLuloMdb(buffer);
    return NextResponse.json({ success: true, ...inspection });
  } catch (err: unknown) {
    const message = formatMdbReadError(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
