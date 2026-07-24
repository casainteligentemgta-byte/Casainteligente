import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularCostoTotalInsumoApu,
  calcularCostoUnitarioDirectoApu,
  clasificarInsumoApu,
  type LineaApuCalculoInput,
} from '@/lib/proyectos/apuCalculos';
import {
  precioUnitarioVentaDesdeCostoDirecto,
  type MargenesLuloObra,
} from '@/lib/proyectos/lulo/aplicarMargenesLulo';
import { montoPartidaDesdeCantidadPrecio } from '@/lib/utils/numericDbLimits';

const BATCH = 80;

type PartidaRow = {
  id: string;
  codigo_partida?: string | null;
  cantidad_presupuestada?: number | null;
  precio_unitario_estimado?: number | null;
  monto_total_estimado?: number | null;
  [key: string]: unknown;
};

type ApuJoinRow = {
  partida_id: string;
  cantidad_rendimiento: number;
  desperdicio_porcentaje: number;
  insumo:
    | {
        precio_base: number;
        tipo: string | null;
      }
    | {
        precio_base: number;
        tipo: string | null;
      }[]
    | null;
};

function insumoDesdeJoin(raw: ApuJoinRow['insumo']): { precio_base: number; tipo: string | null } | null {
  const ins = Array.isArray(raw) ? raw[0] : raw;
  if (!ins) return null;
  return { precio_base: Number(ins.precio_base ?? 0), tipo: ins.tipo ?? null };
}

function partidaNecesitaMontos(p: PartidaRow): boolean {
  return Number(p.precio_unitario_estimado ?? 0) <= 0 || Number(p.monto_total_estimado ?? 0) <= 0;
}

/**
 * Recalcula P.U. y monto desde líneas APU ya guardadas en Supabase (para datos importados sin montos).
 */
export async function enriquecerPartidasMontosDesdeApuDb<T extends PartidaRow>(
  supabase: SupabaseClient,
  partidas: T[],
  margenes?: MargenesLuloObra,
  options?: { persistir?: boolean },
): Promise<{ partidas: T[]; actualizadas: number }> {
  const pendientes = partidas.filter((p) => p.id && partidaNecesitaMontos(p));
  if (pendientes.length === 0) {
    return { partidas, actualizadas: 0 };
  }

  const ids = pendientes.map((p) => p.id);
  const lineasPorPartida = new Map<string, LineaApuCalculoInput[]>();

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('ci_presupuesto_partida_apu')
      .select(
        'partida_id, cantidad_rendimiento, desperdicio_porcentaje, insumo:ci_lulo_insumos_maestro(precio_base, tipo)',
      )
      .in('partida_id', batch);

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('ci_presupuesto_partida_apu')) {
        return { partidas, actualizadas: 0 };
      }
      throw error;
    }

    for (const row of (data ?? []) as ApuJoinRow[]) {
      const ins = insumoDesdeJoin(row.insumo);
      if (!ins || ins.precio_base <= 0) continue;
      const list = lineasPorPartida.get(row.partida_id) ?? [];
      list.push({
        cantidad_rendimiento: Number(row.cantidad_rendimiento ?? 0),
        desperdicio_porcentaje: Number(row.desperdicio_porcentaje ?? 0),
        insumo: ins,
      });
      lineasPorPartida.set(row.partida_id, list);
    }
  }

  if (lineasPorPartida.size === 0) {
    return { partidas, actualizadas: 0 };
  }

  const updates: Array<{ id: string; precio_unitario_estimado: number; monto_total_estimado: number }> =
    [];

  const resultado = partidas.map((p) => {
    if (!partidaNecesitaMontos(p)) return p;
    const lineas = lineasPorPartida.get(p.id);
    if (!lineas?.length) return p;

    const costoDirecto = calcularCostoUnitarioDirectoApu(lineas);
    if (costoDirecto <= 0) return p;

    const precio =
      Number(p.precio_unitario_estimado) > 0
        ? Number(p.precio_unitario_estimado)
        : precioUnitarioVentaDesdeCostoDirecto(costoDirecto, margenes);

    const cantidad = Number(p.cantidad_presupuestada) || 0;
    const monto =
      Number(p.monto_total_estimado) > 0
        ? Number(p.monto_total_estimado)
        : montoPartidaDesdeCantidadPrecio(cantidad, precio);

    if (precio <= 0 && monto <= 0) return p;

    updates.push({
      id: p.id,
      precio_unitario_estimado: precio,
      monto_total_estimado: monto,
    });

    return {
      ...p,
      precio_unitario_estimado: precio,
      monto_total_estimado: monto,
    };
  });

  if (options?.persistir && updates.length > 0) {
    for (const u of updates) {
      await supabase
        .from('ci_presupuesto_partidas')
        .update({
          precio_unitario_estimado: u.precio_unitario_estimado,
          monto_total_estimado: u.monto_total_estimado,
        })
        .eq('id', u.id);
    }
  }

  return { partidas: resultado, actualizadas: updates.length };
}

/** Suma costo directo por partida (útil para diagnóstico). */
export function costoDirectoDesdeLineasApu(lineas: LineaApuCalculoInput[]): number {
  return lineas.reduce((sum, linea) => {
    const cat = clasificarInsumoApu(linea.insumo.tipo);
    return (
      sum +
      calcularCostoTotalInsumoApu(
        cat,
        linea.cantidad_rendimiento,
        linea.insumo.precio_base,
        linea.desperdicio_porcentaje,
      )
    );
  }, 0);
}
