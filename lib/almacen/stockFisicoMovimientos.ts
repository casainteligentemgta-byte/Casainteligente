import type { SupabaseClient } from '@supabase/supabase-js';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';
import type { StockProyectoItem } from '@/lib/almacen/listarStockProyecto';
import type {
  FilaMovimientoInventario,
  FiltrosMovimientosInventario,
} from '@/lib/almacen/listarMovimientosInventario';

function nombreMat(raw: unknown): { id: string; name: string; unit: string; sap: string | null } {
  const m = Array.isArray(raw) ? raw[0] : raw;
  if (!m || typeof m !== 'object') {
    return { id: '', name: 'Material', unit: 'UND', sap: null };
  }
  const o = m as { id?: string; name?: string; unit?: string; sap_code?: string | null };
  return {
    id: String(o.id ?? ''),
    name: String(o.name ?? 'Material'),
    unit: String(o.unit ?? 'UND'),
    sap: o.sap_code ?? null,
  };
}

function nombreProy(raw: unknown): { id: string; nombre: string } {
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== 'object') return { id: '', nombre: '' };
  const o = p as { id?: string; nombre?: string };
  return { id: String(o.id ?? ''), nombre: String(o.nombre ?? '') };
}

function nombreUbi(raw: unknown): string {
  const u = Array.isArray(raw) ? raw[0] : raw;
  if (!u || typeof u !== 'object') return '';
  return String((u as { nombre?: string }).nombre ?? '').trim();
}

function itemStockAFila(
  item: StockProyectoItem,
  proyectoId: string | null,
  proyectoNombre: string | null,
  hoy: string,
): FilaMovimientoInventario | null {
  if (!item.material_id || !item.ubicacion_id || item.cantidad_disponible <= 0) return null;
  return {
    id: `stk-phys-${item.ubicacion_id}_${item.material_id}`,
    tipo: 'almacenado',
    fecha: hoy,
    hora: null,
    material_id: item.material_id,
    material_nombre: item.nombre,
    material_codigo: item.sap_code,
    unidad: item.unidad,
    cantidad: item.cantidad_disponible,
    proveedor: null,
    origen: null,
    destino: item.ubicacion_nombre || null,
    proyecto_id: proyectoId,
    proyecto_nombre: proyectoNombre,
    referencia: null,
    capitulo: null,
    notas: 'Stock físico (inventario_stock)',
    ubicacion_id: item.ubicacion_id,
    eliminable: false,
  };
}

async function nombresProyectos(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from('ci_proyectos').select('id, nombre').in('id', ids);
  for (const row of data ?? []) {
    map.set(String(row.id), String(row.nombre ?? ''));
  }
  return map;
}

/** Stock físico desde inventario_stock (misma fuente que /almacen/despacho). */
export async function cargarFilasStockFisico(
  supabase: SupabaseClient,
  filtros: Pick<
    FiltrosMovimientosInventario,
    'proyectoId' | 'proyectoIdsEntidad' | 'ubicacionId' | 'materialIdsCategoria'
  >,
): Promise<FilaMovimientoInventario[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const materialSet = filtros.materialIdsCategoria?.length
    ? new Set(filtros.materialIdsCategoria)
    : null;
  const filas: FilaMovimientoInventario[] = [];

  const proyectoIds: string[] = [];
  if (filtros.proyectoId?.trim()) proyectoIds.push(filtros.proyectoId.trim());
  else if (filtros.proyectoIdsEntidad?.length) proyectoIds.push(...filtros.proyectoIdsEntidad);

  if (proyectoIds.length) {
    const nombres = await nombresProyectos(supabase, proyectoIds);
    for (const pid of proyectoIds) {
      const items = await getStockRealObra(supabase, pid, {
        ubicacionId: filtros.ubicacionId,
        soloConStock: true,
        proyectoNombre: nombres.get(pid),
      });
      const proyNombre = nombres.get(pid) ?? null;
      for (const item of items) {
        if (materialSet && !materialSet.has(item.material_id)) continue;
        const fila = itemStockAFila(item, pid, proyNombre, hoy);
        if (fila) filas.push(fila);
      }
    }
    return filas.sort((a, b) => b.cantidad - a.cantidad || a.material_nombre.localeCompare(b.material_nombre, 'es'));
  }

  let q = supabase
    .from('inventario_stock')
    .select(
      `
      ubicacion_id,
      cantidad_disponible,
      ubicacion:inv_ubicaciones (
        id,
        nombre,
        ci_proyecto_id,
        proyecto:ci_proyectos ( id, nombre )
      ),
      material:global_inventory ( id, name, unit, sap_code )
    `,
    )
    .gt('cantidad_disponible', 0)
    .order('cantidad_disponible', { ascending: false })
    .limit(500);

  if (filtros.ubicacionId) {
    q = q.eq('ubicacion_id', filtros.ubicacionId);
  }

  const { data, error } = await q;
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const mat = nombreMat(row.material);
    if (!mat.id) continue;
    if (materialSet && !materialSet.has(mat.id)) continue;
    const ubId = String(row.ubicacion_id ?? '');
    if (!ubId) continue;
    const proy = nombreProy(
      (Array.isArray(row.ubicacion) ? row.ubicacion[0] : row.ubicacion) as { proyecto?: unknown } | null
        ? ((Array.isArray(row.ubicacion) ? row.ubicacion[0] : row.ubicacion) as { proyecto?: unknown }).proyecto
        : null,
    );
    const proyId =
      proy.id ||
      String(
        (Array.isArray(row.ubicacion) ? row.ubicacion[0] : row.ubicacion) as { ci_proyecto_id?: string } | null
          ? ((Array.isArray(row.ubicacion) ? row.ubicacion[0] : row.ubicacion) as { ci_proyecto_id?: string })
              .ci_proyecto_id ?? ''
          : '',
      ) ||
      null;
    const qty = Number(row.cantidad_disponible ?? 0);
    if (qty <= 0) continue;
    filas.push({
      id: `stk-phys-${ubId}_${mat.id}`,
      tipo: 'almacenado',
      fecha: hoy,
      hora: null,
      material_id: mat.id,
      material_nombre: mat.name,
      material_codigo: mat.sap,
      unidad: mat.unit,
      cantidad: qty,
      proveedor: null,
      origen: null,
      destino: nombreUbi(row.ubicacion) || null,
      proyecto_id: proyId,
      proyecto_nombre: proy.nombre || null,
      referencia: null,
      capitulo: null,
      notas: 'Stock físico (inventario_stock)',
      ubicacion_id: ubId,
      eliminable: false,
    });
  }

  return filas.sort((a, b) => b.cantidad - a.cantidad || a.material_nombre.localeCompare(b.material_nombre, 'es'));
}

export function filaStockAStockProyectoItem(f: FilaMovimientoInventario): StockProyectoItem | null {
  if (!f.material_id || !f.ubicacion_id || f.cantidad <= 0) return null;
  return {
    material_id: f.material_id,
    ubicacion_id: f.ubicacion_id,
    ubicacion_nombre: f.destino ?? 'Almacén',
    nombre: f.material_nombre,
    unidad: f.unidad,
    sap_code: f.material_codigo,
    categoria: null,
    cantidad_disponible: f.cantidad,
  };
}
