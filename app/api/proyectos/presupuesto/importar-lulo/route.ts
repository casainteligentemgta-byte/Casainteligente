import { createClient } from '@/lib/supabase/server';
import { parsePresupuestoLuloCsv } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import { parsePresupuestoLuloMdb } from '@/lib/proyectos/parsePresupuestoLuloMdb';
import type { GastoObraLuloInsert } from '@/types/lulo-import';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 200;

function isMdbFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.mdb') || name.endsWith('.accdb');
}

async function insertBatches<T extends Record<string, unknown>>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  rows: T[],
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();
    const file = formData.get('file');
    const proyectoId = String(formData.get('proyectoId') ?? '').trim();
    const reemplazar = formData.get('reemplazar') === 'true' || formData.get('reemplazar') === '1';
    const importarGastos =
      formData.get('importarGastos') !== 'false' && formData.get('importarGastos') !== '0';

    if (!(file instanceof File) || !proyectoId) {
      return NextResponse.json({ error: 'Archivo o proyectoId faltante' }, { status: 400 });
    }

    let partidasInsert: ReturnType<typeof parsePresupuestoLuloCsv> = [];
    let gastosInsert: GastoObraLuloInsert[] = [];
    let meta: Record<string, unknown> = { formato: isMdbFile(file) ? 'mdb' : 'csv' };

    if (isMdbFile(file)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = parsePresupuestoLuloMdb(buffer, proyectoId);
      partidasInsert = parsed.partidas;
      gastosInsert = importarGastos ? parsed.gastos : [];
      meta = { ...meta, ...parsed.meta };
    } else {
      const text = await file.text();
      partidasInsert = parsePresupuestoLuloCsv(text, proyectoId);
    }

    if (partidasInsert.length === 0 && gastosInsert.length === 0) {
      return NextResponse.json(
        {
          error: isMdbFile(file)
            ? 'No se encontraron partidas ni gastos válidos en el MDB. Revisa que el archivo sea de Lulo/Access.'
            : 'No se encontraron partidas válidas en el CSV.',
          meta,
        },
        { status: 400 },
      );
    }

    if (reemplazar) {
      await supabase
        .from('ci_presupuesto_partidas')
        .delete()
        .eq('proyecto_id', proyectoId)
        .in('origen', ['lulo_csv', 'lulo_mdb']);

      if (importarGastos) {
        const { error: delGastos } = await supabase
          .from('gastos_obra')
          .delete()
          .eq('proyecto_id', proyectoId)
          .eq('origen', 'lulo_mdb');
        if (delGastos && !delGastos.message.includes('proyecto_id')) throw delGastos;
      }
    }

    if (partidasInsert.length > 0) {
      await insertBatches(supabase, 'ci_presupuesto_partidas', partidasInsert);
    }

    if (gastosInsert.length > 0) {
      await insertBatches(supabase, 'gastos_obra', gastosInsert);
    }

    const presupuestoTotal =
      typeof meta.presupuestoTotalUsd === 'number'
        ? meta.presupuestoTotalUsd
        : partidasInsert.reduce((s, p) => s + p.monto_total_estimado, 0);

    const parts: string[] = [];
    if (partidasInsert.length > 0) parts.push(`${partidasInsert.length} partidas`);
    if (gastosInsert.length > 0) parts.push(`${gastosInsert.length} gastos`);

    return NextResponse.json({
      success: true,
      message: `Importación Lulo: ${parts.join(' y ')}.`,
      partidas: partidasInsert.length,
      gastos: gastosInsert.length,
      presupuestoTotalUsd: presupuestoTotal,
      reemplazar,
      meta,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar el presupuesto.';
    console.error('[POST /api/proyectos/presupuesto/importar-lulo]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
