import type { SupabaseClient } from '@supabase/supabase-js';
import { labelPartida } from '@/lib/almacen/inventoryClasificacion';
import type { PartidaDespachoFila } from '@/types/inventario-obra';

type PartidaPresupuestoRow = {
  id: string;
  codigo_partida: string;
  descripcion: string;
  proyecto_id: string;
  unidad: string;
  cantidad_presupuestada: number;
};

const ESTADOS_CONSUMO = ['pendiente', 'en_transito', 'completado'] as const;

/** Consumo ya imputado por partida de presupuesto + material. */
export async function cargarConsumoPorPartidaMaterial(
  supabase: SupabaseClient,
  params: { proyectoId: string; materialId: string },
): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  const { data: lineas, error: lErr } = await supabase
    .from('transferencias_inventario_lineas')
    .select(
      `
      id,
      material_id,
      transferencia:transferencias_inventario!inner (
        id,
        ci_proyecto_id,
        estado
      )
    `,
    )
    .eq('material_id', params.materialId);

  if (lErr?.code === '42P01') return map;
  if (lErr) throw new Error(lErr.message);

  const lineaIds = (lineas ?? [])
    .filter((row) => {
      const t = row.transferencia as { ci_proyecto_id?: string; estado?: string } | null;
      if (!t) return false;
      if (t.ci_proyecto_id && t.ci_proyecto_id !== params.proyectoId) return false;
      return ESTADOS_CONSUMO.includes((t.estado ?? '') as (typeof ESTADOS_CONSUMO)[number]);
    })
    .map((row) => String(row.id));

  if (!lineaIds.length) return map;

  const { data: detalles, error: dErr } = await supabase
    .from('detalle_transferencia_partidas')
    .select('ci_presupuesto_partida_id, partida_id, cantidad_imputada')
    .in('transferencia_linea_id', lineaIds);

  if (dErr?.code === '42P01') return map;
  if (dErr) throw new Error(dErr.message);

  for (const d of detalles ?? []) {
    const key =
      d.ci_presupuesto_partida_id != null
        ? `cpp:${d.ci_presupuesto_partida_id}`
        : d.partida_id != null
          ? `p:${d.partida_id}`
          : null;
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + Number(d.cantidad_imputada ?? 0));
  }

  return map;
}

function partidaKey(p: { id: string }): string {
  return `cpp:${p.id}`;
}

async function loadPartidasPresupuesto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PartidaPresupuestoRow[]> {
  const { data, error } = await supabase
    .from('ci_presupuesto_partidas')
    .select('id,codigo_partida,descripcion,proyecto_id,unidad,cantidad_presupuestada')
    .eq('proyecto_id', proyectoId)
    .order('codigo_partida');
  if (error) throw new Error(error.message);
  return (data ?? []) as PartidaPresupuestoRow[];
}

/** Opciones de partida para repartir cantidad de un material en despacho. */
export async function cargarOpcionesPartidaDespacho(
  supabase: SupabaseClient,
  params: { proyectoId: string; materialId: string },
): Promise<PartidaDespachoFila[]> {
  const [partidas, consumoMap] = await Promise.all([
    loadPartidasPresupuesto(supabase, params.proyectoId),
    cargarConsumoPorPartidaMaterial(supabase, params),
  ]);

  if (!partidas.length) return [];

  const { data: techos, error: tErr } = await supabase
    .from('obra_partidas_materiales')
    .select(
      'id, partida_id, ci_presupuesto_partida_id, cantidad_techo, unidad, material_id',
    )
    .eq('ci_proyecto_id', params.proyectoId)
    .eq('material_id', params.materialId);

  if (tErr?.code === '42P01') {
    /* sin tabla 180: techo 0 */
  } else if (tErr) {
    throw new Error(tErr.message);
  }

  const techoPorPartida = new Map<string, { id: string; techo: number; unidad: string }>();
  for (const row of techos ?? []) {
    const key =
      row.ci_presupuesto_partida_id != null
        ? `cpp:${row.ci_presupuesto_partida_id}`
        : row.partida_id != null
          ? `p:${row.partida_id}`
          : null;
    if (!key) continue;
    techoPorPartida.set(key, {
      id: String(row.id),
      techo: Number(row.cantidad_techo ?? 0),
      unidad: String(row.unidad ?? 'UND'),
    });
  }

  return partidas.map((p) => {
    const key = partidaKey(p);
    const techoRow = techoPorPartida.get(key);
    const consumido = consumoMap.get(key) ?? 0;
    const techoMaterial = techoRow?.techo ?? 0;
    const techoPartida = Number(p.cantidad_presupuestada ?? 0);
    const techo =
      techoMaterial > 0 ? techoMaterial : techoPartida > 0 ? techoPartida : 0;

    return {
      obra_partida_material_id: techoRow?.id ?? `cpp-${p.id}`,
      partida_id: null,
      ci_presupuesto_partida_id: p.id,
      nombre_partida: labelPartida(p),
      cantidad_presupuestada: techo,
      cantidad_asignada_real: consumido,
      unidad: techoRow?.unidad ?? p.unidad ?? 'UND',
    } satisfies PartidaDespachoFila;
  });
}
