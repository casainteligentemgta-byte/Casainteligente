import type { SupabaseClient } from '@supabase/supabase-js';
import { labelPartida } from '@/lib/almacen/inventoryClasificacion';
import { resolverInsumoIdsParaMaterial } from '@/lib/almacen/resolverInsumosMaterial';
import {
  calcularTechoCantidadInsumoPartida,
  clasificarInsumoApu,
} from '@/lib/proyectos/apuCalculos';
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

type InsumoApuJoin = {
  id: string;
  tipo: string | null;
  unidad: string | null;
};

type ApuMaterialRowRaw = {
  partida_id: string;
  cantidad_rendimiento: number | null;
  desperdicio_porcentaje: number | null;
  insumo: InsumoApuJoin | InsumoApuJoin[] | null;
  partida: PartidaPresupuestoRow | PartidaPresupuestoRow[] | null;
};

function insumoDesdeJoin(
  raw: ApuMaterialRowRaw['insumo'],
): InsumoApuJoin | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function partidaDesdeJoin(
  raw: ApuMaterialRowRaw['partida'],
  fallbackId: string,
  partidaById: Map<string, PartidaPresupuestoRow>,
): PartidaPresupuestoRow | undefined {
  if (Array.isArray(raw)) return raw[0];
  if (raw) return raw;
  return partidaById.get(fallbackId);
}

/** Partidas cuyo APU incluye insumos vinculados al material, con techo de cantidad calculado. */
async function cargarPartidasDesdeApuMaterial(
  supabase: SupabaseClient,
  params: { proyectoId: string; insumoIds: string[] },
): Promise<Map<string, { techo: number; unidad: string; partida: PartidaPresupuestoRow }>> {
  const map = new Map<string, { techo: number; unidad: string; partida: PartidaPresupuestoRow }>();
  if (!params.insumoIds.length) return map;

  const partidas = await loadPartidasPresupuesto(supabase, params.proyectoId);
  const partidaById = new Map(partidas.map((p) => [p.id, p]));
  if (!partidas.length) return map;

  const partidaIds = partidas.map((p) => p.id);
  const BATCH = 80;

  for (let i = 0; i < partidaIds.length; i += BATCH) {
    const batchIds = partidaIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('ci_presupuesto_partida_apu')
      .select(
        `
        partida_id,
        cantidad_rendimiento,
        desperdicio_porcentaje,
        insumo:ci_lulo_insumos_maestro ( id, tipo, unidad ),
        partida:ci_presupuesto_partidas!inner (
          id, codigo_partida, descripcion, proyecto_id, unidad, cantidad_presupuestada
        )
      `,
      )
      .in('partida_id', batchIds)
      .in('insumo_id', params.insumoIds);

    if (error?.code === '42P01') return map;
    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as ApuMaterialRowRaw[]) {
      const insumo = insumoDesdeJoin(row.insumo);
      const partida = partidaDesdeJoin(row.partida, row.partida_id, partidaById);
      if (!insumo || !partida) continue;
      if (clasificarInsumoApu(insumo.tipo) !== 'material') continue;

      const key = partidaKey(partida);
      const techoLinea = calcularTechoCantidadInsumoPartida(
        Number(row.cantidad_rendimiento) || 0,
        Number(row.desperdicio_porcentaje) || 0,
        Number(partida.cantidad_presupuestada) || 0,
      );
      const prev = map.get(key);
      const techo = (prev?.techo ?? 0) + techoLinea;
      map.set(key, {
        techo,
        unidad: insumo.unidad?.trim() || partida.unidad || 'UND',
        partida,
      });
    }
  }

  return map;
}

/**
 * Opciones de partida en destino que llevan el material (APU Lulo + techos en obra).
 * Solo devuelve partidas asociadas al producto, no todo el presupuesto.
 */
export async function cargarOpcionesPartidaDespacho(
  supabase: SupabaseClient,
  params: { proyectoId: string; materialId?: string; soloRelacionadas?: boolean },
): Promise<PartidaDespachoFila[]> {
  const soloRelacionadas = params.soloRelacionadas ?? true;
  const materialId = params.materialId?.trim() || '';
  const consumoMap = materialId
    ? await cargarConsumoPorPartidaMaterial(supabase, {
        proyectoId: params.proyectoId,
        materialId,
      })
    : new Map<string, number>();

  const insumoIds = materialId
    ? await resolverInsumoIdsParaMaterial(supabase, materialId)
    : [];

  const apuMap = await cargarPartidasDesdeApuMaterial(supabase, {
    proyectoId: params.proyectoId,
    insumoIds,
  });

  const { data: techos, error: tErr } = await supabase
    .from('obra_partidas_materiales')
    .select(
      'id, partida_id, ci_presupuesto_partida_id, cantidad_techo, unidad, material_id',
    )
    .eq('ci_proyecto_id', params.proyectoId)
    .eq('material_id', materialId || '__material_inexistente__');

  if (tErr?.code === '42P01') {
    /* sin tabla 180 */
  } else if (tErr) {
    throw new Error(tErr.message);
  }

  const techoPorPartida = new Map<
    string,
    { id: string; techo: number; unidad: string; partida?: PartidaPresupuestoRow }
  >();

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

  const partidas = await loadPartidasPresupuesto(supabase, params.proyectoId);
  const partidaByKey = new Map(partidas.map((p) => [partidaKey(p), p]));
  const keysMaterial = new Set<string>();
  if (soloRelacionadas) {
    for (const k of Array.from(techoPorPartida.keys())) keysMaterial.add(k);
    for (const k of Array.from(apuMap.keys())) keysMaterial.add(k);
    if (keysMaterial.size === 0) return [];
  } else {
    for (const p of partidas) keysMaterial.add(partidaKey(p));
  }

  const filas: PartidaDespachoFila[] = [];

  for (const key of Array.from(keysMaterial)) {
    const apu = apuMap.get(key);
    const techoRow = techoPorPartida.get(key);
    const partida =
      apu?.partida ??
      (key.startsWith('cpp:')
        ? partidaByKey.get(key)
        : undefined);

    if (!partida) continue;

    const consumido = consumoMap.get(key) ?? 0;
    const techoMaterial = techoRow?.techo ?? 0;
    const techoApu = apu?.techo ?? 0;
    const techo = techoMaterial > 0 ? techoMaterial : techoApu > 0 ? techoApu : 0;

    filas.push({
      obra_partida_material_id: techoRow?.id ?? `apu-${partida.id}`,
      partida_id: null,
      ci_presupuesto_partida_id: partida.id,
      nombre_partida: labelPartida(partida),
      cantidad_presupuestada: techo,
      cantidad_asignada_real: consumido,
      unidad: techoRow?.unidad ?? apu?.unidad ?? partida.unidad ?? 'UND',
    });
  }

  filas.sort((a, b) => a.nombre_partida.localeCompare(b.nombre_partida, 'es'));
  return filas;
}
