import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarOpcionesPartidaDespacho } from '@/lib/almacen/cargarPartidasDespacho';
import type { ImputacionPartidaInput } from '@/types/inventario-obra';

function keyPartida(imp: ImputacionPartidaInput): string | null {
  if (imp.ci_presupuesto_partida_id) return `cpp:${imp.ci_presupuesto_partida_id}`;
  if (imp.partida_id) return `p:${imp.partida_id}`;
  return null;
}

/**
 * Persiste en obra_partidas_materiales el techo que ya calcula la UI (APU Lulo),
 * para que el trigger inv_validar_imputacion_partida no vea techo 0 por fila ausente.
 */
export async function sincronizarTechosImputacionDespacho(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    materialId: string;
    imputaciones: ImputacionPartidaInput[];
  },
): Promise<void> {
  const proyectoId = params.proyectoId.trim();
  const materialId = params.materialId.trim();
  if (!proyectoId || !materialId || !params.imputaciones.length) return;

  const filas = await cargarOpcionesPartidaDespacho(supabase, {
    proyectoId,
    materialId,
    soloRelacionadas: false,
  });
  const porKey = new Map(
    filas.map((f) => {
      const k = f.ci_presupuesto_partida_id
        ? `cpp:${f.ci_presupuesto_partida_id}`
        : f.partida_id
          ? `p:${f.partida_id}`
          : null;
      return k ? ([k, f] as const) : null;
    }).filter(Boolean) as Array<[string, (typeof filas)[0]]>,
  );

  for (const imp of params.imputaciones) {
    const key = keyPartida(imp);
    if (!key) continue;
    const fila = porKey.get(key);
    const techo = Number(fila?.cantidad_presupuestada) || 0;
    if (techo <= 0) continue;

    const unidad = fila?.unidad?.trim() || 'UND';
    let q = supabase
      .from('obra_partidas_materiales')
      .select('id, cantidad_techo')
      .eq('ci_proyecto_id', proyectoId)
      .eq('material_id', materialId);

    if (imp.ci_presupuesto_partida_id) {
      q = q.eq('ci_presupuesto_partida_id', imp.ci_presupuesto_partida_id);
    } else if (imp.partida_id) {
      q = q.eq('partida_id', imp.partida_id);
    }

    const { data: existente, error: readErr } = await q.maybeSingle();
    if (readErr?.code === '42P01') return;
    if (readErr) throw new Error(readErr.message);

    if (existente?.id) {
      const actual = Number(existente.cantidad_techo) || 0;
      if (techo <= actual + 0.0001) continue;
      const { error: updErr } = await supabase
        .from('obra_partidas_materiales')
        .update({ cantidad_techo: techo, unidad, updated_at: new Date().toISOString() })
        .eq('id', existente.id);
      if (updErr) throw new Error(updErr.message);
      continue;
    }

    const { error: insErr } = await supabase.from('obra_partidas_materiales').insert({
      ci_proyecto_id: proyectoId,
      material_id: materialId,
      ci_presupuesto_partida_id: imp.ci_presupuesto_partida_id ?? null,
      partida_id: imp.partida_id ?? null,
      cantidad_techo: techo,
      unidad,
    });
    if (insErr) throw new Error(insErr.message);
  }
}
