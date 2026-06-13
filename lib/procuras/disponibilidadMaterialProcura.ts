import type { SupabaseClient } from '@supabase/supabase-js';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';
import { esUbicacionAlmacenFisico } from '@/lib/almacen/inventarioFiltroUbicacion';

export type DisponibilidadMaterialProcura = {
  hayStock: boolean;
  cantidad: number;
  unidad: string;
  almacenNombre: string | null;
};

function mejorAlmacenDesdeFilas(
  filas: Array<{ ubicacion_nombre: string; cantidad_disponible: number; unidad?: string }>,
): { cantidad: number; almacenNombre: string; unidad: string } | null {
  let mejor: { cantidad: number; almacenNombre: string; unidad: string } | null = null;
  for (const f of filas) {
    const qty = Number(f.cantidad_disponible ?? 0);
    if (qty <= 0) continue;
    const nombre = String(f.ubicacion_nombre ?? 'Almacén').trim() || 'Almacén';
    const unidad = String(f.unidad ?? 'UND').trim() || 'UND';
    if (!mejor || qty > mejor.cantidad) {
      mejor = { cantidad: qty, almacenNombre: nombre, unidad };
    }
  }
  return mejor;
}

async function stockObraMaterial(
  supabase: SupabaseClient,
  proyectoId: string,
  materialId: string,
): Promise<{ cantidad: number; almacenNombre: string; unidad: string } | null> {
  const filas = await getStockRealObra(supabase, proyectoId, {
    materialId,
    soloConStock: true,
  });

  const almacenes = filas.filter((f) => esUbicacionAlmacenFisico(f.ubicacion_tipo));
  return mejorAlmacenDesdeFilas(
    almacenes.map((f) => ({
      ubicacion_nombre: f.ubicacion_nombre,
      cantidad_disponible: f.cantidad_disponible,
      unidad: f.unidad,
    })),
  );
}

/** Consulta stock solo en almacenes físicos de la obra/proyecto. */
export async function consultarDisponibilidadMaterialProcura(
  supabase: SupabaseClient,
  opts: {
    materialId?: string | null;
    proyectoId?: string | null;
    unidadFallback?: string;
  },
): Promise<DisponibilidadMaterialProcura> {
  const unidadFallback = opts.unidadFallback?.trim() || 'UND';
  const materialId = opts.materialId?.trim() || null;
  if (!materialId) {
    return { hayStock: false, cantidad: 0, unidad: unidadFallback, almacenNombre: null };
  }

  const proyectoId = opts.proyectoId?.trim() || null;
  if (!proyectoId) {
    return { hayStock: false, cantidad: 0, unidad: unidadFallback, almacenNombre: null };
  }

  const obra = await stockObraMaterial(supabase, proyectoId, materialId);
  if (obra) {
    return {
      hayStock: true,
      cantidad: obra.cantidad,
      unidad: obra.unidad || unidadFallback,
      almacenNombre: obra.almacenNombre,
    };
  }

  return { hayStock: false, cantidad: 0, unidad: unidadFallback, almacenNombre: null };
}

export function lineaDisponibilidadMaterialProcura(
  d: DisponibilidadMaterialProcura,
  escHtml: (s: string) => string,
): string {
  if (!d.hayStock || !d.almacenNombre) {
    return '🏪 <b>NO HAY DISPONIBILIDAD</b> en almacén de la obra';
  }
  const qty = d.cantidad.toLocaleString('es-VE');
  return (
    `🏪 Disponible en obra: <b>${qty}</b> ${escHtml(d.unidad)} en <b>${escHtml(d.almacenNombre)}</b>`
  );
}
