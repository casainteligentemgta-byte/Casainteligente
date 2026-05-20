import { createClient } from '@/lib/supabase/server';
import { formatMdbReadError, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import { parsePresupuestoLuloCsvComplete } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import { parsePresupuestoLuloMdb } from '@/lib/proyectos/parsePresupuestoLuloMdb';
import type { LuloSnapshotResumen } from '@/types/lulo-import';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** MDB/ACCDB de Lulo pueden ser grandes */
export const maxDuration = 120;

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

    const formato = isMdbFile(file) ? 'mdb' : 'csv';
    let partidasInsert: Record<string, unknown>[] = [];
    let gastosInsert: Record<string, unknown>[] = [];
    let payload: Record<string, unknown> = {};
    let meta: Record<string, unknown> = { formato };

    if (formato === 'mdb') {
      const buffer = toMdbNodeBuffer(await file.arrayBuffer());
      const parsed = parsePresupuestoLuloMdb(buffer, proyectoId, importarGastos);
      partidasInsert = parsed.partidas;
      gastosInsert = parsed.gastos;
      payload = parsed.fullDump as unknown as Record<string, unknown>;
      meta = { ...meta, ...parsed.meta };
    } else {
      const text = await file.text();
      const parsed = parsePresupuestoLuloCsvComplete(text, proyectoId, importarGastos);
      partidasInsert = parsed.partidas;
      gastosInsert = parsed.gastos;
      payload = parsed.fullDump as unknown as Record<string, unknown>;
      meta = { ...meta, ...parsed.meta };
    }

    if (partidasInsert.length === 0 && gastosInsert.length === 0) {
      const diag =
        typeof meta.diagnosticoResumen === 'string' ? meta.diagnosticoResumen : '';
      const base =
        formato === 'mdb'
          ? 'No se encontraron partidas ni gastos válidos en el MDB. Revisa que el archivo sea de Lulo/Access.'
          : 'No se encontraron partidas ni gastos válidos en el CSV.';
      return NextResponse.json(
        {
          error: diag ? `${base} ${diag}` : base,
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

      await supabase.from('ci_lulo_import_snapshots').delete().eq('proyecto_id', proyectoId);

      if (importarGastos) {
        const { error: delGastos } = await supabase
          .from('gastos_obra')
          .delete()
          .eq('proyecto_id', proyectoId)
          .in('origen', ['lulo_mdb', 'lulo_csv']);
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
        : partidasInsert.reduce(
            (s, p) => s + Number((p as { monto_total_estimado: number }).monto_total_estimado),
            0,
          );

    let filasTotales = partidasInsert.length + gastosInsert.length;
    if (formato === 'mdb' && payload.tables && Array.isArray(payload.tables)) {
      filasTotales = (payload.tables as { rowCount?: number }[]).reduce(
        (s, t) => s + (t.rowCount ?? 0),
        0,
      );
    } else if (formato === 'csv' && Array.isArray(payload.rows)) {
      filasTotales = payload.rows.length;
    }

    const resumen: LuloSnapshotResumen = {
      partidas: partidasInsert.length,
      gastos: gastosInsert.length,
      presupuestoTotalUsd: presupuestoTotal as number,
      formato,
      tablas: formato === 'mdb' ? (meta.tablasPartidas as string[])?.length : 1,
      filasTotales,
    };

    const { data: snap, error: snapErr } = await supabase
      .from('ci_lulo_import_snapshots')
      .insert({
        proyecto_id: proyectoId,
        nombre_archivo: file.name,
        formato,
        resumen,
        payload,
      })
      .select('id, created_at')
      .single();

    if (snapErr) {
      console.warn('[importar-lulo] snapshot no guardado:', snapErr.message);
    }

    const parts: string[] = [];
    if (partidasInsert.length > 0) parts.push(`${partidasInsert.length} partidas`);
    if (gastosInsert.length > 0) parts.push(`${gastosInsert.length} gastos`);

    return NextResponse.json({
      success: true,
      message: `Importación Lulo: ${parts.join(' y ')}.`,
      partidas: partidasInsert.length,
      gastos: gastosInsert.length,
      presupuestoTotalUsd: presupuestoTotal,
      snapshotId: snap?.id ?? null,
      reemplazar,
      meta,
      resumen,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : 'Error al importar el presupuesto.';
    const friendly = formatMdbReadError(err);
    if (friendly !== raw) {
      return NextResponse.json({ error: friendly }, { status: 400 });
    }
    console.error('[POST /api/proyectos/presupuesto/importar-lulo]', err);
    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
