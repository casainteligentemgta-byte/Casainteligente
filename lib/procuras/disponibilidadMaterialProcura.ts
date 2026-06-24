import type { SupabaseClient } from '@supabase/supabase-js';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';
import {
  esUbicacionAlmacenFisico,
  resolverUbicacionIdsFiltroEntidad,
  type ProyectoFiltroUbicacion,
} from '@/lib/almacen/inventarioFiltroUbicacion';
import { listarUbicacionesInventario } from '@/lib/almacen/ubicacionesInventario';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';

export type DisponibilidadMaterialProcura = {
  hayStock: boolean;
  cantidad: number;
  unidad: string;
  almacenNombre: string | null;
};

export type AlmacenStockEntidad = {
  nombre: string;
  cantidad: number;
  proyectoNombre?: string | null;
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

type UbicacionStockRow = {
  cantidad_disponible?: number | null;
  ubicacion?:
    | {
        id?: string;
        nombre?: string;
        tipo?: string | null;
        proyecto?: { nombre?: string } | { nombre?: string }[] | null;
      }
    | {
        id?: string;
        nombre?: string;
        tipo?: string | null;
        proyecto?: { nombre?: string } | { nombre?: string }[] | null;
      }[]
    | null;
};

/** Stock del material en almacenes físicos de todos los proyectos de la entidad. */
export async function listarAlmacenesStockMaterialEntidad(
  supabase: SupabaseClient,
  opts: {
    materialId?: string | null;
    entidadId?: string | null;
    proyectoId?: string | null;
  },
): Promise<AlmacenStockEntidad[]> {
  const materialId = opts.materialId?.trim() || null;
  if (!materialId) return [];

  let entidadId = opts.entidadId?.trim() || null;
  if (!entidadId && opts.proyectoId?.trim()) {
    entidadId = await resolverEntidadIdDesdeProyecto(supabase, opts.proyectoId.trim());
  }
  if (!entidadId) return [];

  const [ubicaciones, { data: proyectos }] = await Promise.all([
    listarUbicacionesInventario(supabase),
    supabase.from('ci_proyectos').select('id, nombre, entidad_id').eq('entidad_id', entidadId),
  ]);

  const proyectoFiltros: ProyectoFiltroUbicacion[] = (proyectos ?? []).map((p) => ({
    id: String(p.id),
    nombre: String(p.nombre ?? ''),
    entidad_id: p.entidad_id ? String(p.entidad_id) : null,
  }));

  const ubicacionIds = resolverUbicacionIdsFiltroEntidad(ubicaciones, {
    entidadId,
    proyectos: proyectoFiltros,
  });
  if (!ubicacionIds.length) return [];

  const porUbicacion = new Map<string, AlmacenStockEntidad>();
  const BATCH = 40;

  for (let i = 0; i < ubicacionIds.length; i += BATCH) {
    const batch = ubicacionIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('inventario_stock')
      .select(
        'cantidad_disponible, ubicacion:inv_ubicaciones(id, nombre, tipo, proyecto:ci_proyectos(nombre))',
      )
      .eq('material_id', materialId)
      .in('ubicacion_id', batch)
      .gt('cantidad_disponible', 0);

    if (error) {
      console.warn('[disponibilidadMaterialProcura] stock entidad', error.message);
      continue;
    }

    for (const row of (data ?? []) as UbicacionStockRow[]) {
      const qty = Number(row.cantidad_disponible ?? 0);
      if (qty <= 0) continue;
      const ubRaw = Array.isArray(row.ubicacion) ? row.ubicacion[0] : row.ubicacion;
      if (!ubRaw || !esUbicacionAlmacenFisico(ubRaw.tipo)) continue;
      const ubId = String(ubRaw.id ?? '').trim();
      if (!ubId) continue;
      const proyRaw = ubRaw.proyecto;
      const proy = Array.isArray(proyRaw) ? proyRaw[0] : proyRaw;
      const nombre = String(ubRaw.nombre ?? 'Almacén').trim() || 'Almacén';
      const prev = porUbicacion.get(ubId);
      if (!prev || qty > prev.cantidad) {
        porUbicacion.set(ubId, {
          nombre,
          cantidad: qty,
          proyectoNombre: proy?.nombre?.trim() || null,
        });
      }
    }
  }

  return Array.from(porUbicacion.values()).sort((a, b) => b.cantidad - a.cantidad);
}

export function lineasAlmacenesEntidadProcura(
  almacenes: AlmacenStockEntidad[],
  unidad: string,
  escHtml: (s: string) => string,
): string {
  if (!almacenes.length) return '';
  const lineas = almacenes.map((a) => {
    const obra = a.proyectoNombre ? ` (${escHtml(a.proyectoNombre)})` : '';
    return (
      `  • <b>${escHtml(a.nombre)}</b>${obra}: ` +
      `${a.cantidad.toLocaleString('es-VE')} ${escHtml(unidad)}`
    );
  });
  return `\n🏭 <b>Stock en entidad (verificado):</b>\n${lineas.join('\n')}`;
}

export function notaLogisticaStockEntidadComprador(
  almacenes: AlmacenStockEntidad[],
): string {
  if (!almacenes.length) return '';
  const lista = almacenes
    .slice(0, 5)
    .map((a) => {
      const obra = a.proyectoNombre ? ` (${a.proyectoNombre})` : '';
      return `${a.nombre}${obra}: ${a.cantidad.toLocaleString('es-VE')}`;
    })
    .join('; ');
  return (
    `\n📍 <b>Nota logística:</b> hay stock en almacenes de la entidad — ` +
    `${lista}. Verifique antes de comprar o coordine el traslado.`
  );
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
