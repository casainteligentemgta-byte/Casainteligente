import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { extraerMdbLuloCompleto } from '@/lib/proyectos/extraerMdbLuloCompleto';
import {
  buildResumenSnapshotExtraccion,
  guardarSnapshotLulo,
} from '@/lib/proyectos/extraerMdbLuloCompleto';
import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import { formatMdbReadError, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import { parseLuloMdbEstructurado } from '@/lib/proyectos/parseLuloMdbEstructurado';
import { persistirLuloEstructurado } from '@/lib/proyectos/persistirLuloEstructurado';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

function isMdbFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith('.mdb') || n.endsWith('.accdb');
}

async function resolveSupabaseMigracion(): Promise<SupabaseClient> {
  const admin = createSupabaseAdminOnlyClient();
  if (admin) return admin;
  return createClient();
}

async function codigoObraProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from('ci_proyectos')
    .select('codigo_lulo')
    .eq('id', proyectoId)
    .maybeSingle();
  const cod = data?.codigo_lulo;
  return typeof cod === 'string' && cod.trim() ? cod.trim() : undefined;
}

/**
 * Migración Lulo nativa (INSUMOS → PARTIDAS → COMPOSICION / OBRAS)
 * hacia `ci_lulo_insumos_maestro`, `ci_presupuesto_partidas`, `ci_presupuesto_partida_apu`.
 */
export async function postMigrarLuloMdbNativo(
  req: Request,
  proyectoId: string,
): Promise<NextResponse> {
  try {
    const pid = proyectoId.trim();
    if (!pid) {
      return NextResponse.json({ error: 'proyectoId requerido en la URL' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se cargó ningún archivo.' }, { status: 400 });
    }
    if (!isMdbFile(file)) {
      return NextResponse.json(
        { error: 'Solo archivos .mdb o .accdb de Lulo/Access.' },
        { status: 400 },
      );
    }

    const reemplazar =
      formData.get('reemplazar') === 'true' || formData.get('reemplazar') === '1';
    const codigoObraForm = String(formData.get('codigoObra') ?? formData.get('codigo_lulo') ?? '').trim();

    const supabase = await resolveSupabaseMigracion();
    const buffer = toMdbNodeBuffer(await file.arrayBuffer());
    const extraccion = extraerMdbLuloCompleto(buffer);
    const dump = extraccion.payload as LuloMdbFullDump;

    const codigoObra =
      codigoObraForm || (await codigoObraProyecto(supabase, pid)) || undefined;

    const structured = parseLuloMdbEstructurado(dump, pid, { codigoObra });
    if (!structured || structured.partidas.length === 0) {
      return NextResponse.json(
        {
          error:
            'El MDB no tiene tablas Lulo nativas (INSUMOS/PARTIDAS/COMPOSICION) o no se pudo leer ninguna partida.',
          hint: 'Usa importar-lulo para volcado genérico o revisa nombres de tablas en Datos Lulo.',
          catalogoTablas: extraccion.catalogoTablas,
        },
        { status: 422 },
      );
    }

    const persisted = await persistirLuloEstructurado(supabase, pid, structured, { reemplazar });

    const presupuestoTotal = structured.partidas.reduce((s, p) => s + p.monto_total_estimado, 0);
    const resumen = buildResumenSnapshotExtraccion(extraccion, {
      partidas: persisted.partidasInsertadas,
      gastos: 0,
      presupuestoTotalUsd: presupuestoTotal,
    });

    const snap = await guardarSnapshotLulo(supabase, {
      proyectoId: pid,
      nombreArchivo: file.name,
      extraccion,
      resumen,
      reemplazarSnapshots: reemplazar,
    });

    return NextResponse.json({
      success: true,
      message: 'Base de datos de Lulo migrada exitosamente.',
      proyectoId: pid,
      insumos: persisted.insumosUpserted,
      partidas: persisted.partidasInsertadas,
      apu: persisted.apuInsertados,
      presupuestoTotalUsd: presupuestoTotal,
      proyectoActualizado: persisted.proyectoActualizado,
      tablas: structured.tablasUsadas,
      snapshotId: snap?.id ?? null,
      usoServiceRole: Boolean(createSupabaseAdminOnlyClient()),
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : 'Error interno del servidor';
    const friendly = formatMdbReadError(err);
    console.error('[postMigrarLuloMdbNativo]', err);
    return NextResponse.json(
      { error: friendly !== raw ? friendly : raw },
      { status: friendly !== raw ? 400 : 500 },
    );
  }
}
