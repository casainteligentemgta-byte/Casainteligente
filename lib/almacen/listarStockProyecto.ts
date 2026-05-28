import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarUbicacionesInventario,
  propagarObraIdFlat,
} from '@/lib/almacen/ubicacionesInventario';

export type StockProyectoItem = {
  material_id: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  nombre: string;
  unidad: string;
  sap_code: string | null;
  categoria: string | null;
  cantidad_disponible: number;
};

const SELECT_STOCK = `
  ubicacion_id,
  cantidad_disponible,
  material:global_inventory (
    id,
    name,
    unit,
    sap_code,
    category:material_categories ( name )
  )
`;

function mapRow(
  row: {
    ubicacion_id: string;
    cantidad_disponible: number | null;
    material:
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
  },
  ubicacionNombre: string,
): StockProyectoItem | null {
  const raw = row.material;
  const mat = Array.isArray(raw) ? raw[0] : raw;
  if (!mat?.id) return null;
  const catRaw = mat.category;
  const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
  return {
    material_id: mat.id,
    ubicacion_id: row.ubicacion_id,
    ubicacion_nombre: ubicacionNombre,
    nombre: mat.name ?? 'Material',
    unidad: mat.unit ?? 'UND',
    sap_code: mat.sap_code ?? null,
    categoria: cat?.name ?? null,
    cantidad_disponible: Number(row.cantidad_disponible ?? 0),
  };
}

/** Stock en todos los almacenes / subsitios de la obra (ci_proyectos). */
export async function listarStockProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: { ubicacionId?: string },
): Promise<StockProyectoItem[]> {
  const todas = await listarUbicacionesInventario(supabase, { soloActivas: true });
  propagarObraIdFlat(todas);

  let ubicacionesObra = todas.filter((u) => u.obra_id === proyectoId);
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
    const { data, error } = await supabase
      .from('inventario_stock')
      .select(SELECT_STOCK)
      .in('ubicacion_id', batch)
      .gt('cantidad_disponible', 0)
      .order('cantidad_disponible', { ascending: false });

    if (error?.code === '42P01') return [];
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const mapped = mapRow(
        row as Parameters<typeof mapRow>[0],
        nombrePorId.get(String(row.ubicacion_id)) ?? 'Almacén',
      );
      if (mapped && mapped.cantidad_disponible > 0) items.push(mapped);
    }
  }

  items.sort((a, b) => {
    const ca = (a.categoria ?? '').localeCompare(b.categoria ?? '', 'es');
    if (ca !== 0) return ca;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  return items;
}
