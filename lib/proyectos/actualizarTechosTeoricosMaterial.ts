import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularTechoTeoricoMaterialPartida,
  type LineaApuCalculoInput,
} from '@/lib/proyectos/apuCalculos';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

const BATCH = 100;

type PartidaRow = {
  id: string;
  cantidad_presupuestada: number | null;
};

type ApuJoinRow = {
  partida_id: string;
  cantidad_rendimiento: number | null;
  desperdicio_porcentaje: number | null;
  ci_lulo_insumos_maestro: {
    precio_base: number | null;
    tipo: string | null;
  } | null;
};

/**
 * Recalcula y persiste `techo_teorico_material` para todas las partidas de un proyecto.
 */
export async function actualizarTechosTeoricosMaterialProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  partidaIdsFilter?: string[],
): Promise<{ partidasActualizadas: number }> {
  const pid = proyectoId.trim();

  let partidasQuery = supabase
    .from('ci_presupuesto_partidas')
    .select('id, cantidad_presupuestada')
    .eq('proyecto_id', pid);

  if (partidaIdsFilter?.length) {
    partidasQuery = partidasQuery.in('id', partidaIdsFilter);
  }

  const { data: partidas, error: pErr } = await partidasQuery;
  if (pErr) throw new Error(formatErrorMessage(pErr));

  const partidaRows = (partidas ?? []) as PartidaRow[];
  if (partidaRows.length === 0) return { partidasActualizadas: 0 };

  const ids = partidaRows.map((p) => p.id);
  const apuPorPartida = new Map<string, LineaApuCalculoInput[]>();

  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH);
    const { data: apuRows, error: aErr } = await supabase
      .from('ci_presupuesto_partida_apu')
      .select(
        'partida_id, cantidad_rendimiento, desperdicio_porcentaje, ci_lulo_insumos_maestro ( precio_base, tipo )',
      )
      .in('partida_id', batchIds);
    if (aErr) throw new Error(formatErrorMessage(aErr));

    for (const row of (apuRows ?? []) as ApuJoinRow[]) {
      const insumo = row.ci_lulo_insumos_maestro;
      if (!insumo) continue;
      const linea: LineaApuCalculoInput = {
        cantidad_rendimiento: Number(row.cantidad_rendimiento) || 0,
        desperdicio_porcentaje: Number(row.desperdicio_porcentaje) || 0,
        insumo: {
          precio_base: Number(insumo.precio_base) || 0,
          tipo: insumo.tipo,
        },
      };
      const list = apuPorPartida.get(row.partida_id) ?? [];
      list.push(linea);
      apuPorPartida.set(row.partida_id, list);
    }
  }

  const updates: Array<{ id: string; techo_teorico_material: number }> = [];
  for (const p of partidaRows) {
    const lineas = apuPorPartida.get(p.id) ?? [];
    const techo = calcularTechoTeoricoMaterialPartida(
      lineas,
      Number(p.cantidad_presupuestada) || 0,
    );
    updates.push({ id: p.id, techo_teorico_material: techo });
  }

  let partidasActualizadas = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    for (const u of batch) {
      const { error } = await supabase
        .from('ci_presupuesto_partidas')
        .update({ techo_teorico_material: u.techo_teorico_material })
        .eq('id', u.id);
      if (error) throw new Error(formatErrorMessage(error));
      partidasActualizadas += 1;
    }
  }

  return { partidasActualizadas };
}
