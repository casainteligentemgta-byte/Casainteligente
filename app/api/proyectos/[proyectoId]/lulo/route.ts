import { createClient } from '@/lib/supabase/server';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { enriquecerPartidasMontosDesdeApuDb } from '@/lib/proyectos/lulo/enriquecerPartidasDesdeApuDb';
import { enriquecerPartidasMontosDesdeVolcado } from '@/lib/proyectos/lulo/enriquecerMontosDesdeVolcado';
import { persistirMontosPartidasLulo } from '@/lib/proyectos/lulo/persistirMontosPartidasLulo';
import { payloadComoMdbDump } from '@/lib/proyectos/lulo/luloProyectoTypes';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const APU_PARTIDAS_BATCH = 150;

async function contarApuPorPartidas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partidaIds: string[],
): Promise<{ apuLineas: number; insumosEnApu: number }> {
  if (partidaIds.length === 0) return { apuLineas: 0, insumosEnApu: 0 };

  const insumoIds = new Set<string>();
  let apuLineas = 0;

  for (let i = 0; i < partidaIds.length; i += APU_PARTIDAS_BATCH) {
    const batch = partidaIds.slice(i, i + APU_PARTIDAS_BATCH);
    const { data, error } = await supabase
      .from('ci_presupuesto_partida_apu')
      .select('insumo_id')
      .in('partida_id', batch);

    if (error) {
      if (
        error.message.includes('does not exist') ||
        error.message.includes('ci_presupuesto_partida_apu')
      ) {
        return { apuLineas: 0, insumosEnApu: 0 };
      }
      console.warn('[GET lulo] apu batch:', error.message);
      continue;
    }
    for (const row of data ?? []) {
      apuLineas += 1;
      if (row.insumo_id) insumoIds.add(row.insumo_id);
    }
  }

  return { apuLineas, insumosEnApu: insumoIds.size };
}

async function cargarProyectoLulo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
) {
  const extendido = await supabase
    .from('ci_proyectos')
    .select(
      'id, nombre, codigo_lulo, porcentaje_admin, porcentaje_utilidad, porcentaje_fcm, ubicacion_texto, obra_ubicacion, obra_cliente',
    )
    .eq('id', proyectoId)
    .maybeSingle();

  if (!extendido.error) return extendido.data;

  const msg = extendido.error.message ?? '';
  if (msg.includes('codigo_lulo') || msg.includes('porcentaje_') || msg.includes('obra_') || msg.includes('ubicacion_') || extendido.error.code === '42703') {
    const basico = await supabase
      .from('ci_proyectos')
      .select('id, nombre, ubicacion_texto')
      .eq('id', proyectoId)
      .maybeSingle();
    if (basico.error) throw new Error(formatErrorMessage(basico.error));
    return basico.data;
  }

  throw new Error(formatErrorMessage(extendido.error));
}

async function cargarPartidasLulo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
) {
  const conOrigen = await supabase
    .from('ci_presupuesto_partidas')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .in('origen', ['lulo_csv', 'lulo_mdb'])
    .order('capitulo_orden', { ascending: true })
    .order('codigo_partida');

  if (!conOrigen.error) return conOrigen.data ?? [];

  const msg = conOrigen.error.message ?? '';
  if (msg.includes('capitulo_orden')) {
    const sinOrden = await supabase
      .from('ci_presupuesto_partidas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .in('origen', ['lulo_csv', 'lulo_mdb'])
      .order('codigo_partida');
    if (!sinOrden.error) return sinOrden.data ?? [];
    throw new Error(formatErrorMessage(sinOrden.error));
  }

  if (msg.includes('origen')) {
    const todas = await supabase
      .from('ci_presupuesto_partidas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('codigo_partida');
    if (!todas.error) return todas.data ?? [];
    throw new Error(formatErrorMessage(todas.error));
  }

  throw new Error(formatErrorMessage(conOrigen.error));
}

async function cargarGastosLulo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
) {
  const conOrigen = await supabase
    .from('gastos_obra')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .in('origen', ['lulo_csv', 'lulo_mdb'])
    .order('fecha', { ascending: false });

  if (!conOrigen.error) return conOrigen.data ?? [];

  const msg = conOrigen.error.message ?? '';
  if (msg.includes('proyecto_id') || msg.includes('origen')) {
    const todas = await supabase
      .from('gastos_obra')
      .select('*')
      .order('fecha', { ascending: false });
    if (!todas.error) {
      return (todas.data ?? []).filter(
        (g) => (g as { proyecto_id?: string }).proyecto_id === proyectoId,
      );
    }
    throw new Error(formatErrorMessage(todas.error));
  }

  throw new Error(formatErrorMessage(conOrigen.error));
}

export async function GET(
  _req: Request,
  { params }: { params: { proyectoId: string } },
) {
  try {
    const proyectoId = params.proyectoId?.trim();
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json(
        { error: mensajeProyectoIdInvalido(proyectoId) },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const [partidas, gastos, snapshotsRes, ultimoSnapshotRes, proyecto] = await Promise.all([
      cargarPartidasLulo(supabase, proyectoId),
      cargarGastosLulo(supabase, proyectoId),
      supabase
        .from('ci_lulo_import_snapshots')
        .select('id, nombre_archivo, formato, resumen, created_at')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('ci_lulo_import_snapshots')
        .select('payload')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      cargarProyectoLulo(supabase, proyectoId),
    ]);

    if (snapshotsRes.error) {
      console.warn('[GET lulo] snapshots:', snapshotsRes.error.message);
    }

    const pMeta = proyecto as {
      porcentaje_admin?: number | null;
      porcentaje_utilidad?: number | null;
      porcentaje_fcm?: number | null;
    } | null;
    const margenes = pMeta
      ? {
          porcentaje_admin: pMeta.porcentaje_admin,
          porcentaje_utilidad: pMeta.porcentaje_utilidad,
          porcentaje_fcm: pMeta.porcentaje_fcm,
        }
      : undefined;

    const dumpVolcado = payloadComoMdbDump(ultimoSnapshotRes.data?.payload);

    let partidasTrabajo = partidas;
    let montosDesdeVolcado = 0;
    let mapaMontosVolcado = 0;

    if (dumpVolcado) {
      const vol = enriquecerPartidasMontosDesdeVolcado(partidasTrabajo, dumpVolcado);
      partidasTrabajo = vol.partidas;
      montosDesdeVolcado = vol.actualizadas;
      mapaMontosVolcado = vol.mapaSize;
      if (vol.actualizadas > 0) {
        await persistirMontosPartidasLulo(supabase, partidas, vol.partidas);
      }
    }

    const { partidas: partidasConMontos, actualizadas } = await enriquecerPartidasMontosDesdeApuDb(
      supabase,
      partidasTrabajo,
      margenes,
      { persistir: true },
    );

    const partidaIds = partidasConMontos.map((p) => p.id).filter(Boolean);
    const { apuLineas, insumosEnApu } = await contarApuPorPartidas(supabase, partidaIds);

    let insumosMaestroTotal = 0;
    const { count, error: insErr } = await supabase
      .from('ci_lulo_insumos_maestro')
      .select('*', { count: 'exact', head: true });
    if (!insErr) insumosMaestroTotal = count ?? 0;
    else if (!insErr.message?.includes('does not exist')) {
      console.warn('[GET lulo] insumos maestro:', insErr.message);
    }

    return NextResponse.json({
      proyecto,
      partidas: partidasConMontos,
      gastos,
      snapshots: snapshotsRes.data ?? [],
      resumenNativo: {
        apuLineas,
        insumosEnApu,
        insumosMaestroTotal,
        montosRecalculadosDesdeApu: actualizadas,
        montosDesdeVolcadoMdb: montosDesdeVolcado,
        mapaMontosVolcado,
        tieneSnapshotMdb: Boolean(dumpVolcado),
      },
    });
  } catch (err: unknown) {
    const message = formatErrorMessage(err) || 'Error al cargar datos Lulo';
    console.error('[GET lulo]', err);
    return NextResponse.json({ error: message, hint: message }, { status: 500 });
  }
}
