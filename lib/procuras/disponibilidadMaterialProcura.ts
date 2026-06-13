import type { SupabaseClient } from '@supabase/supabase-js';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';
import { esUbicacionAlmacenFisico } from '@/lib/almacen/inventarioFiltroUbicacion';
import { cargarStockPorUbicaciones } from '@/lib/almacen/inventarioFiltroUbicacion';
import { listarUbicacionesPorEntidad } from '@/lib/almacen/ubicacionesInventario';

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

async function stockEntidadMaterial(
  supabase: SupabaseClient,
  entidadId: string,
  materialId: string,
  excluirProyectoId?: string | null,
): Promise<{ cantidad: number; almacenNombre: string; unidad: string } | null> {
  const ubicaciones = await listarUbicacionesPorEntidad(supabase, entidadId, {
    excluirProyectoId: excluirProyectoId?.trim() || undefined,
  });
  const idsAlmacen = ubicaciones
    .filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil')
    .map((u) => u.id);
  if (!idsAlmacen.length) return null;

  const map = await cargarStockPorUbicaciones(supabase, idsAlmacen);
  const resumen = map.get(materialId);
  if (!resumen || resumen.cantidad_disponible <= 0) return null;

  const almacenNombre =
    resumen.ubicacion_nombres.find(Boolean)?.trim() ||
    resumen.ubicacion_nombres[0]?.trim() ||
    'Almacén';

  return {
    cantidad: resumen.cantidad_disponible,
    almacenNombre,
    unidad: 'UND',
  };
}

/** Consulta stock en almacenes de la obra y, si no hay, en almacenes de la entidad. */
export async function consultarDisponibilidadMaterialProcura(
  supabase: SupabaseClient,
  opts: {
    materialId?: string | null;
    proyectoId?: string | null;
    entidadId?: string | null;
    unidadFallback?: string;
  },
): Promise<DisponibilidadMaterialProcura> {
  const unidadFallback = opts.unidadFallback?.trim() || 'UND';
  const materialId = opts.materialId?.trim() || null;
  if (!materialId) {
    return { hayStock: false, cantidad: 0, unidad: unidadFallback, almacenNombre: null };
  }

  const proyectoId = opts.proyectoId?.trim() || null;
  const entidadId = opts.entidadId?.trim() || null;

  if (proyectoId) {
    const obra = await stockObraMaterial(supabase, proyectoId, materialId);
    if (obra) {
      return {
        hayStock: true,
        cantidad: obra.cantidad,
        unidad: obra.unidad || unidadFallback,
        almacenNombre: obra.almacenNombre,
      };
    }
  }

  if (entidadId) {
    const ent = await stockEntidadMaterial(supabase, entidadId, materialId, proyectoId);
    if (ent) {
      return {
        hayStock: true,
        cantidad: ent.cantidad,
        unidad: ent.unidad || unidadFallback,
        almacenNombre: ent.almacenNombre,
      };
    }
  }

  return { hayStock: false, cantidad: 0, unidad: unidadFallback, almacenNombre: null };
}

export function lineaDisponibilidadMaterialProcura(
  d: DisponibilidadMaterialProcura,
  escHtml: (s: string) => string,
): string {
  if (!d.hayStock || !d.almacenNombre) {
    return '🏪 <b>NO HAY DISPONIBILIDAD</b>';
  }
  const qty = d.cantidad.toLocaleString('es-VE');
  return (
    `🏪 Disponible: <b>${qty}</b> ${escHtml(d.unidad)} en <b>${escHtml(d.almacenNombre)}</b>`
  );
}
