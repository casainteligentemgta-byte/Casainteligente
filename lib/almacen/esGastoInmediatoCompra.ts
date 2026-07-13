import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CATEGORIA_CONSUMIBLES_CAMPO,
  type MaterialCategoryRow,
  buscarCategoriaPorId,
} from '@/lib/almacen/categoriasMaterialCompra';

export const CATEGORIA_SERVICIOS_COMPRA = 'Servicios';

export type LineaGastoInmediatoInput = {
  /** Nombre de categoría (literal exacto en BD). */
  categoria?: string | null;
  /** Alias explícito en UI/API. */
  es_servicio?: boolean | null;
  /** UUID de material_categories; se resuelve con `categorias` si no hay nombre. */
  category_id?: string | null;
};

/**
 * Consumibles de campo y servicios se imputan a contabilidad/proyecto
 * pero no deben incrementar inventario_stock (evita stock fantasma).
 */
export function esGastoInmediatoCompra(
  linea: LineaGastoInmediatoInput,
  categorias?: MaterialCategoryRow[],
): boolean {
  if (linea.es_servicio === true) return true;

  let nombre = String(linea.categoria ?? '').trim();
  if (!nombre && linea.category_id?.trim() && categorias?.length) {
    nombre = buscarCategoriaPorId(categorias, linea.category_id)?.name ?? '';
  }

  if (nombre === CATEGORIA_CONSUMIBLES_CAMPO) return true;
  if (nombre.toLowerCase() === CATEGORIA_SERVICIOS_COMPRA.toLowerCase()) return true;

  return false;
}

export async function resolverCategoriaNombreMaterial(
  supabase: SupabaseClient,
  materialId: string,
): Promise<string | null> {
  const id = materialId.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from('global_inventory')
    .select('category:material_categories ( name )')
    .eq('id', id)
    .maybeSingle();

  if (error && !/does not exist/i.test(error.message ?? '')) {
    throw new Error(error.message);
  }

  const raw = data?.category;
  const row = Array.isArray(raw) ? raw[0] : raw;
  const nombre = row && typeof row === 'object' && 'name' in row ? String(row.name ?? '').trim() : '';
  return nombre || null;
}

export async function materialEsGastoInmediato(
  supabase: SupabaseClient,
  materialId: string,
): Promise<boolean> {
  const categoria = await resolverCategoriaNombreMaterial(supabase, materialId);
  return esGastoInmediatoCompra({ categoria });
}
