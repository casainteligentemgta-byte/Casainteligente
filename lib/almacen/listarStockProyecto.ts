import type { SupabaseClient } from '@supabase/supabase-js';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';
import { esUbicacionAlmacenFisico, ubicacionIdsRaizYDescendientes } from '@/lib/almacen/inventarioFiltroUbicacion';
import { listarMovimientosInventario } from '@/lib/almacen/listarMovimientosInventario';
import { listarUbicacionesInventario } from '@/lib/almacen/ubicacionesInventario';
import { filaStockAStockProyectoItem } from '@/lib/almacen/stockFisicoMovimientos';

export type StockProyectoItem = {
  material_id: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  /** Tipo de ubicación (obra, almacen_central, …) para desglose en /stock. */
  ubicacion_tipo?: string | null;
  nombre: string;
  unidad: string;
  sap_code: string | null;
  categoria: string | null;
  cantidad_disponible: number;
};

async function nombreProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<string | undefined> {
  const { data: prRow } = await supabase
    .from('ci_proyectos')
    .select('nombre')
    .eq('id', proyectoId)
    .maybeSingle();
  const nombre = String(prRow?.nombre ?? '').trim();
  return nombre || undefined;
}

async function resolverUbicacionIdsFiltro(
  supabase: SupabaseClient,
  ubicacionId?: string,
): Promise<string[] | undefined> {
  const raiz = ubicacionId?.trim();
  if (!raiz) return undefined;
  const todas = await listarUbicacionesInventario(supabase, { soloActivas: true });
  return ubicacionIdsRaizYDescendientes(todas, raiz);
}

/** Stock en almacenes / subsitios de la obra (misma lógica que cuadro de movimientos). */
export async function listarStockProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: { ubicacionId?: string; soloAlmacenesFisicos?: boolean },
): Promise<StockProyectoItem[]> {
  const proyectoNombre = await nombreProyecto(supabase, proyectoId);
  const ubicacionIds = await resolverUbicacionIdsFiltro(supabase, opts?.ubicacionId);

  let items = await getStockRealObra(supabase, proyectoId, {
    ubicacionIds,
    soloConStock: true,
    proyectoNombre,
  });

  if (!items.length) {
    const mov = await listarMovimientosInventario(supabase, {
      vista: 'almacenado',
      proyectoId,
      ubicacionIds,
      limite: 400,
    });
    items = mov.filas
      .map((fila) => filaStockAStockProyectoItem(fila))
      .filter((x): x is StockProyectoItem => x != null);
  }

  if (opts?.soloAlmacenesFisicos) {
    items = items.filter((i) => esUbicacionAlmacenFisico(i.ubicacion_tipo));
  }

  return items;
}
