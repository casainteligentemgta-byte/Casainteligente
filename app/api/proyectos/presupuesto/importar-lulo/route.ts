import { createClient } from '@/lib/supabase/server';
import { parsePresupuestoLuloCsv } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 200;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();
    const file = formData.get('file');
    const proyectoId = String(formData.get('proyectoId') ?? '').trim();
    const reemplazar = formData.get('reemplazar') === 'true' || formData.get('reemplazar') === '1';

    if (!(file instanceof File) || !proyectoId) {
      return NextResponse.json({ error: 'Archivo o proyectoId faltante' }, { status: 400 });
    }

    const text = await file.text();
    const partidasInsert = parsePresupuestoLuloCsv(text, proyectoId);

    if (partidasInsert.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron partidas válidas en el CSV.' },
        { status: 400 },
      );
    }

    if (reemplazar) {
      const { error: delError } = await supabase
        .from('ci_presupuesto_partidas')
        .delete()
        .eq('proyecto_id', proyectoId)
        .eq('origen', 'lulo_csv');
      if (delError) throw delError;
    }

    for (let i = 0; i < partidasInsert.length; i += BATCH_SIZE) {
      const batch = partidasInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('ci_presupuesto_partidas').insert(batch);
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      message: `${partidasInsert.length} partidas importadas con éxito desde Lulo.`,
      count: partidasInsert.length,
      reemplazar,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar el presupuesto.';
    console.error('[POST /api/proyectos/presupuesto/importar-lulo]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
