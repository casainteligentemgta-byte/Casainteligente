import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarUbicacionesInventario,
  propagarObraIdFlat,
} from '@/lib/almacen/ubicacionesInventario';
import { ubicacionPerteneceAProyecto } from '@/lib/almacen/inventarioFiltroUbicacion';
import type { StockProyectoItem } from '@/lib/almacen/listarStockProyecto';

type RpcStockRow = {
  material_id: string;
  ubicacion_id: string;
  ubicacion_nombre: string | null;
  cantidad_disponible: number | null;
  material_name: string | null;
  material_unit: string | null;
  material_sap_code: string | null;
  categoria_nombre: string | null;
};

/** Stock real en frentes de obra vía RPC get_stock_real_obra (fallback a inventario_stock directo). */
export async function getStockRealObra(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: {
    ubicacionId?: string;
    materialId?: string;
    soloConStock?: boolean;
    proyectoNombre?: string;
  },
): Promise<StockProyectoItem[]> {
  const { data, error } = await supabase.rpc('get_stock_real_obra', {
    p_proyecto_id: proyectoId,
    p_ubicacion_id: opts?.ubicacionId ?? null,
    p_material_id: opts?.materialId ?? null,
    p_solo_con_stock: opts?.soloConStock !== false,
  });

  if (error?.code === '42883' || /get_stock_real_obra/i.test(error?.message ?? '')) {
    return listarStockProyectoDesdeTablas(supabase, proyectoId, opts);
  }
  if (error) throw new Error(error.message);

  return ((data ?? []) as RpcStockRow[]).map((row) => ({
    material_id: String(row.material_id),
    ubicacion_id: String(row.ubicacion_id),
    ubicacion_nombre: String(row.ubicacion_nombre ?? 'Almacén'),
    nombre: String(row.material_name ?? 'Material'),
    unidad: String(row.material_unit ?? 'UND'),
    sap_code: row.material_sap_code ?? null,
    categoria: row.categoria_nombre ?? null,
    cantidad_disponible: Number(row.cantidad_disponible ?? 0),
  }));
}

/** Suma de cantidad_disponible por material en toda la obra. */
export async function getStockAgregadoPorMaterialObra(
  supabase: SupabaseClient,
  proyectoId: string,
  proyectoNombre?: string,
): Promise<Map<string, number>> {
  const filas = await getStockRealObra(supabase, proyectoId, {
    soloConStock: false,
    proyectoNombre,
  });
  const map = new Map<string, number>();
  for (const f of filas) {
    map.set(f.material_id, (map.get(f.material_id) ?? 0) + f.cantidad_disponible);
  }
  return map;
}

/** Fallback si la RPC aún no está en Supabase (migr. 187). */
async function listarStockProyectoDesdeTablas(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: { ubicacionId?: string; soloConStock?: boolean; proyectoNombre?: string },
): Promise<StockProyectoItem[]> {
  const todas = await listarUbicacionesInventario(supabase, { soloActivas: true });
  propagarObraIdFlat(todas);
  let ubicacionesObra = todas.filter((u) =>
    ubicacionPerteneceAProyecto(u, proyectoId, opts?.proyectoNombre),
  );
  if (opts?.ubicacionId) {
    ubicacionesObra = ubicacionesObra.filter((u) => u.id === opts.ubicacionId);
  }
  if (!ubicacionesObra.length) return [];

  const nombrePorId = new Map(ubicacionesObra.map((u) => [u.id, u.nombre]));
  const ids = ubicacionesObra.map((u) => u.id);
  const items: StockProyectoItem[] = [];
  const BATCH = 40;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    let q = supabase
      .from('inventario_stock')
      .select(
        `
        ubicacion_id,
        cantidad_disponible,
        material:global_inventory ( id, name, unit, sap_code, category:material_categories ( name ) )
      `,
      )
      .in('ubicacion_id', batch);
    if (opts?.soloConStock !== false) {
      q = q.gt('cantidad_disponible', 0);
    }
    const { data, error } = await q;
    if (error?.code === '42P01') return [];
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const raw = row.material as
        | {
            id: string;
            name: string;
            unit: string;
            sap_code: string | null;
            category: { name: string } | Array<{ name: string }> | null;
          }
        | Array<{
            id: string;
            name: string;
            unit: string;
            sap_code: string | null;
            category: { name: string } | Array<{ name: string }> | null;
          }>
        | null;
      const mat = Array.isArray(raw) ? raw[0] : raw;
      if (!mat?.id) continue;
      const catRaw = mat.category;
      const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
      const qty = Number(row.cantidad_disponible ?? 0);
      if (opts?.soloConStock !== false && qty <= 0) continue;
      items.push({
        material_id: mat.id,
        ubicacion_id: String(row.ubicacion_id),
        ubicacion_nombre: nombrePorId.get(String(row.ubicacion_id)) ?? 'Almacén',
        nombre: mat.name ?? 'Material',
        unidad: mat.unit ?? 'UND',
        sap_code: mat.sap_code ?? null,
        categoria: cat?.name ?? null,
        cantidad_disponible: qty,
      });
    }
  }

  items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return items;
}
