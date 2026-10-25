import type { SupabaseClient } from '@supabase/supabase-js';
import { listarStockProyecto } from '@/lib/almacen/listarStockProyecto';

export type FilaStockValorizado = {
  materialId: string;
  material: string;
  unidad: string;
  codigo: string;
  ubicacion: string;
  cantidad: number;
  costoPromedioUsd: number;
  valorUsd: number;
};

export type ResumenStockValorizado = {
  lineas: number;
  cantidadTotal: number;
  valorTotalUsd: number;
};

/** Stock valorizado: por obra (recomendado) o muestra global limitada. */
export async function cargarInformeStock(
  supabase: SupabaseClient,
  opts?: { proyectoId?: string | null },
): Promise<{ filas: FilaStockValorizado[]; resumen: ResumenStockValorizado; alcance: string }> {
  const pid = opts?.proyectoId?.trim();

  if (pid) {
    const items = await listarStockProyecto(supabase, pid, { soloAlmacenesFisicos: true });
    const costos = await costosPorMaterial(
      supabase,
      items.map((i) => i.material_id).filter(Boolean),
    );
    const filas: FilaStockValorizado[] = items.map((i) => {
      const costo = costos.get(i.material_id) ?? 0;
      const cantidad = Number(i.cantidad_disponible) || 0;
      return {
        materialId: i.material_id,
        material: i.nombre,
        unidad: i.unidad,
        codigo: i.sap_code ?? '',
        ubicacion: i.ubicacion_nombre || 'Almacén',
        cantidad,
        costoPromedioUsd: costo,
        valorUsd: Math.round(cantidad * costo * 100) / 100,
      };
    });
    filas.sort((a, b) => b.valorUsd - a.valorUsd);
    return { filas, resumen: resumenDe(filas), alcance: 'obra' };
  }

  // Global: top stock con valor (límite para no tumbar la API).
  const { data, error } = await supabase
    .from('inventario_stock')
    .select(
      `
      cantidad_disponible,
      ubicacion:inv_ubicaciones ( nombre ),
      material:global_inventory ( id, name, unit, sap_code, average_weighted_cost )
    `,
    )
    .gt('cantidad_disponible', 0)
    .order('cantidad_disponible', { ascending: false })
    .limit(400);

  if (error?.code === '42P01') {
    throw new Error('Tablas de inventario no disponibles. Revise migraciones de almacén.');
  }
  if (error) throw new Error(error.message);

  const filas: FilaStockValorizado[] = (data ?? []).map((row) => {
    const matRaw = row.material as
      | {
          id?: string;
          name?: string;
          unit?: string;
          sap_code?: string | null;
          average_weighted_cost?: number | null;
        }
      | Array<{
          id?: string;
          name?: string;
          unit?: string;
          sap_code?: string | null;
          average_weighted_cost?: number | null;
        }>
      | null;
    const mat = Array.isArray(matRaw) ? matRaw[0] : matRaw;
    const ubiRaw = row.ubicacion as
      | { nombre?: string }
      | Array<{ nombre?: string }>
      | null;
    const ubi = Array.isArray(ubiRaw) ? ubiRaw[0] : ubiRaw;
    const cantidad = Number(row.cantidad_disponible) || 0;
    const costo = Number(mat?.average_weighted_cost) || 0;
    return {
      materialId: String(mat?.id ?? ''),
      material: String(mat?.name ?? 'Material'),
      unidad: String(mat?.unit ?? 'UND'),
      codigo: String(mat?.sap_code ?? ''),
      ubicacion: String(ubi?.nombre ?? 'Almacén'),
      cantidad,
      costoPromedioUsd: costo,
      valorUsd: Math.round(cantidad * costo * 100) / 100,
    };
  });
  filas.sort((a, b) => b.valorUsd - a.valorUsd);
  return { filas, resumen: resumenDe(filas), alcance: 'global_top' };
}

async function costosPorMaterial(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return out;
  // lotes de 100
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    const { data } = await supabase
      .from('global_inventory')
      .select('id, average_weighted_cost')
      .in('id', chunk);
    for (const row of data ?? []) {
      out.set(String(row.id), Number(row.average_weighted_cost) || 0);
    }
  }
  return out;
}

function resumenDe(filas: FilaStockValorizado[]): ResumenStockValorizado {
  return {
    lineas: filas.length,
    cantidadTotal: filas.reduce((s, f) => s + f.cantidad, 0),
    valorTotalUsd: Math.round(filas.reduce((s, f) => s + f.valorUsd, 0) * 100) / 100,
  };
}
