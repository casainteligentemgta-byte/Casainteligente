import type { SupabaseClient } from '@supabase/supabase-js';
import { movimientoInventarioEsEliminable } from '@/lib/almacen/eliminarMovimientoInventario';

export type VistaMovimientoInventario = 'ingresado' | 'despachado' | 'almacenado' | 'todos';

export type FiltrosMovimientosInventario = {
  vista?: VistaMovimientoInventario;
  proveedor?: string;
  destino?: string;
  proyectoId?: string;
  ubicacionId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  material?: string;
  limite?: number;
};

export type FilaMovimientoInventario = {
  id: string;
  tipo: 'ingreso' | 'despacho' | 'almacenado';
  fecha: string;
  material_id: string | null;
  material_nombre: string;
  material_codigo: string | null;
  unidad: string;
  cantidad: number;
  proveedor: string | null;
  origen: string | null;
  destino: string | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  referencia: string | null;
  capitulo: string | null;
  notas: string | null;
  ubicacion_id: string | null;
  eliminable: boolean;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function incluye(haystack: string, needle: string | undefined): boolean {
  const n = norm(needle ?? '');
  if (!n) return true;
  return norm(haystack).includes(n);
}

function enRangoFecha(fecha: string, desde?: string, hasta?: string): boolean {
  const f = fecha.slice(0, 10);
  if (desde && f < desde.slice(0, 10)) return false;
  if (hasta && f > hasta.slice(0, 10)) return false;
  return true;
}

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

function nombreUbi(raw: unknown): string {
  const u = Array.isArray(raw) ? raw[0] : raw;
  if (!u || typeof u !== 'object') return '';
  return String((u as { nombre?: string }).nombre ?? '').trim();
}

function nombreProy(raw: unknown): { id: string; nombre: string } {
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== 'object') return { id: '', nombre: '' };
  const o = p as { id?: string; nombre?: string };
  return { id: String(o.id ?? ''), nombre: String(o.nombre ?? '') };
}

async function cargarIngresos(
  supabase: SupabaseClient,
  limite: number,
): Promise<FilaMovimientoInventario[]> {
  const { data, error } = await supabase
    .from('compras_facturas')
    .select(
      `
      id,
      numero_factura,
      proveedor_nombre,
      proveedor_rif,
      fecha_emision,
      created_at,
      ubicacion_destino_id,
      ubicacion:inv_ubicaciones ( id, nombre, ci_proyecto_id, proyecto:ci_proyectos ( id, nombre ) ),
      lineas:compras_factura_lineas (
        id,
        cantidad,
        descripcion,
        material:global_inventory ( id, name, unit, sap_code )
      )
    `,
    )
    .eq('estado', 'registrada')
    .order('fecha_emision', { ascending: false })
    .limit(Math.min(limite, 150));

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  const filas: FilaMovimientoInventario[] = [];
  for (const fac of data ?? []) {
    const ubi = fac.ubicacion as unknown;
    const dest = nombreUbi(ubi);
    const proy = nombreProy(
      (Array.isArray(ubi) ? ubi[0] : ubi) as { proyecto?: unknown } | null
        ? ((Array.isArray(ubi) ? ubi[0] : ubi) as { proyecto?: unknown }).proyecto
        : null,
    );
    const fecha = String(fac.fecha_emision ?? fac.created_at ?? '').slice(0, 10);
    const lineas = (fac.lineas ?? []) as Array<{
      id: string;
      cantidad: number;
      descripcion: string;
      material: unknown;
    }>;

    if (!lineas.length) {
      filas.push({
        id: `ing-fac-${fac.id}`,
        tipo: 'ingreso',
        fecha,
        material_id: null,
        material_nombre: '(cabecera sin líneas contables)',
        material_codigo: null,
        unidad: 'UND',
        cantidad: 0,
        proveedor: String(fac.proveedor_nombre ?? ''),
        origen: null,
        destino: dest || null,
        proyecto_id: proy.id || null,
        proyecto_nombre: proy.nombre || null,
        referencia: String(fac.numero_factura ?? ''),
        capitulo: null,
        notas:
          'Al eliminar se borra la cabecera y se revierte stock huérfano en el almacén destino.',
        ubicacion_id: String(fac.ubicacion_destino_id ?? '') || null,
        eliminable: movimientoInventarioEsEliminable(`ing-fac-${fac.id}`),
      });
      continue;
    }

    for (const ln of lineas) {
      const lineaId = String(ln.id ?? '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(lineaId)) continue;

      const mat = nombreMat(ln.material);
      const filaId = `ing-${fac.id}_${lineaId}`;
      filas.push({
        id: filaId,
        tipo: 'ingreso',
        fecha,
        material_id: mat.id || null,
        material_nombre: mat.name || ln.descripcion || 'Material',
        material_codigo: mat.sap,
        unidad: mat.unit,
        cantidad: Number(ln.cantidad ?? 0),
        proveedor: String(fac.proveedor_nombre ?? ''),
        origen: null,
        destino: dest || null,
        proyecto_id: proy.id || null,
        proyecto_nombre: proy.nombre || null,
        referencia: String(fac.numero_factura ?? ''),
        capitulo: null,
        notas: null,
        ubicacion_id: null,
        eliminable: movimientoInventarioEsEliminable(filaId),
      });
    }
  }
  return filas;
}

async function cargarIngresosCuarentena(
  supabase: SupabaseClient,
  limite: number,
): Promise<FilaMovimientoInventario[]> {
  const { data, error } = await supabase
    .from('purchase_details')
    .select(
      `
      id,
      quantity,
      description,
      material_id,
      invoice_id,
      material:global_inventory ( id, name, unit, sap_code ),
      invoice:purchase_invoices (
        id,
        invoice_number,
        supplier_name,
        date,
        ubicacion_destino_id,
        ubicacion:inv_ubicaciones (
          id,
          nombre,
          proyecto:ci_proyectos ( id, nombre )
        )
      )
    `,
    )
    .gt('quantity', 0)
    .order('id', { ascending: false })
    .limit(Math.min(limite, 120));

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  const filas: FilaMovimientoInventario[] = [];
  for (const row of data ?? []) {
    const detailId = String(row.id ?? '').trim();
    const invoiceId = String(row.invoice_id ?? '').trim();
    if (!detailId || !invoiceId) continue;

    const { data: cfVinculada } = await supabase
      .from('compras_facturas')
      .select('id')
      .eq('purchase_invoice_id', invoiceId)
      .maybeSingle();
    if (cfVinculada?.id && row.material_id) {
      const { count: yaEnCompras } = await supabase
        .from('compras_factura_lineas')
        .select('id', { count: 'exact', head: true })
        .eq('factura_id', cfVinculada.id)
        .eq('material_id', row.material_id);
      if ((yaEnCompras ?? 0) > 0) continue;
    }

    const mat = nombreMat(row.material);
    const invRaw = row.invoice;
    const inv = Array.isArray(invRaw) ? invRaw[0] : invRaw;
    const ubiRaw = inv?.ubicacion;
    const ubi = Array.isArray(ubiRaw) ? ubiRaw[0] : ubiRaw;
    const proy = nombreProy(ubi?.proyecto);
    const filaId = `ing-pd-${invoiceId}_${detailId}`;

    filas.push({
      id: filaId,
      tipo: 'ingreso',
      fecha: String(inv?.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      material_id: mat.id || String(row.material_id ?? '') || null,
      material_nombre: mat.name || String(row.description ?? 'Material'),
      material_codigo: mat.sap,
      unidad: mat.unit,
      cantidad: Number(row.quantity ?? 0),
      proveedor: String(inv?.supplier_name ?? ''),
      origen: null,
      destino: nombreUbi(ubi) || null,
      proyecto_id: proy.id || null,
      proyecto_nombre: proy.nombre || null,
      referencia: String(inv?.invoice_number ?? ''),
      capitulo: null,
      notas: 'Ingreso vía cuarentena / detalle de factura',
      ubicacion_id: String(inv?.ubicacion_destino_id ?? ubi?.id ?? '') || null,
      eliminable: movimientoInventarioEsEliminable(filaId),
    });
  }
  return filas;
}

async function cargarDespachosTransferencia(
  supabase: SupabaseClient,
  limite: number,
): Promise<FilaMovimientoInventario[]> {
  const { data, error } = await supabase
    .from('transferencias_inventario')
    .select(
      `
      id,
      codigo,
      tipo_movimiento,
      estado,
      created_at,
      despachado_at,
      observaciones,
      ci_proyecto_id,
      proyecto:ci_proyectos ( id, nombre ),
      origen:inv_ubicaciones!transferencias_inventario_origen_ubicacion_id_fkey ( nombre ),
      destino:inv_ubicaciones!transferencias_inventario_destino_ubicacion_id_fkey ( nombre ),
      lineas:transferencias_inventario_lineas (
        id,
        cantidad,
        material:global_inventory ( id, name, unit, sap_code ),
        imputaciones:detalle_transferencia_partidas (
          cantidad_imputada,
          partida:partidas ( descripcion, capitulo:capitulos ( codigo, nombre ) )
        )
      )
    `,
    )
    .in('estado', ['completado', 'en_transito', 'pendiente'])
    .order('created_at', { ascending: false })
    .limit(Math.min(limite, 120));

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  const filas: FilaMovimientoInventario[] = [];
  for (const tr of data ?? []) {
    const proy = nombreProy(tr.proyecto);
    const origen = nombreUbi(tr.origen);
    const destino = nombreUbi(tr.destino);
    const fecha = String(tr.despachado_at ?? tr.created_at ?? '').slice(0, 10);
    const lineas = (tr.lineas ?? []) as Array<{
      id: string;
      cantidad: number;
      material: unknown;
      imputaciones?: Array<{
        cantidad_imputada: number;
        partida?: unknown;
      }>;
    }>;

    for (const ln of lineas) {
      const mat = nombreMat(ln.material);
      let capitulo: string | null = null;
      const imps = ln.imputaciones ?? [];
      if (imps.length) {
        const p0 = imps[0].partida;
        const part = Array.isArray(p0) ? p0[0] : p0;
        if (part && typeof part === 'object') {
          const capRaw = (part as { capitulo?: unknown }).capitulo;
          const cap = Array.isArray(capRaw) ? capRaw[0] : capRaw;
          if (cap && typeof cap === 'object') {
            const c = cap as { codigo?: string; nombre?: string };
            capitulo = [c.codigo, c.nombre].filter(Boolean).join(' · ') || null;
          }
        }
      }

      const filaId = `desp-tr-${tr.id}-${ln.id}`;
      filas.push({
        id: filaId,
        tipo: 'despacho',
        fecha,
        material_id: mat.id || null,
        material_nombre: mat.name,
        material_codigo: mat.sap,
        unidad: mat.unit,
        cantidad: Number(ln.cantidad ?? 0),
        proveedor: null,
        origen: origen || null,
        destino: destino || null,
        proyecto_id: proy.id || String(tr.ci_proyecto_id ?? '') || null,
        proyecto_nombre: proy.nombre || null,
        referencia: String(tr.codigo ?? ''),
        capitulo,
        notas: String(tr.observaciones ?? '') || null,
        ubicacion_id: null,
        eliminable: movimientoInventarioEsEliminable(filaId),
      });
    }
  }
  return filas;
}

async function cargarDespachosTelegram(
  supabase: SupabaseClient,
  limite: number,
): Promise<FilaMovimientoInventario[]> {
  const { data, error } = await supabase
    .from('ci_obra_movimientos_material')
    .select(
      `
      id,
      created_at,
      observacion,
      capitulo_id,
      capitulo_nombre,
      capitulo:capitulos ( codigo, nombre ),
      proyecto:ci_proyectos ( id, nombre )
    `,
    )
    .eq('tipo', 'salida')
    .order('created_at', { ascending: false })
    .limit(Math.min(limite, 80));

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? []).map((m) => {
    const proy = nombreProy(m.proyecto);
    const capRaw = m.capitulo;
    const cap = Array.isArray(capRaw) ? capRaw[0] : capRaw;
    const capLabel =
      String(m.capitulo_nombre ?? '').trim() ||
      (cap && typeof cap === 'object'
        ? [(cap as { codigo?: string }).codigo, (cap as { nombre?: string }).nombre]
            .filter(Boolean)
            .join(' · ')
        : '') ||
      null;

    const filaId = `desp-tg-${m.id}`;
    return {
      id: filaId,
      tipo: 'despacho' as const,
      fecha: String(m.created_at ?? '').slice(0, 10),
      material_id: null,
      material_nombre: '(registro fotográfico Telegram)',
      material_codigo: null,
      unidad: '—',
      cantidad: 0,
      proveedor: null,
      origen: proy.nombre || null,
      destino: null,
      proyecto_id: proy.id || null,
      proyecto_nombre: proy.nombre || null,
      referencia: 'Telegram /salida',
      capitulo: capLabel,
      notas: String(m.observacion ?? '').slice(0, 300) || null,
      ubicacion_id: null,
      eliminable: movimientoInventarioEsEliminable(filaId),
    };
  });
}

async function cargarAlmacenado(
  supabase: SupabaseClient,
  limite: number,
): Promise<FilaMovimientoInventario[]> {
  const { data, error } = await supabase
    .from('inventario_stock')
    .select(
      `
      stock_id:id,
      ubicacion_id,
      material_id,
      cantidad_disponible,
      updated_at,
      material:global_inventory ( id, name, unit, sap_code ),
      ubicacion:inv_ubicaciones (
        id,
        nombre,
        ci_proyecto_id,
        proyecto:ci_proyectos ( id, nombre )
      )
    `,
    )
    .gt('cantidad_disponible', 0)
    .order('updated_at', { ascending: false })
    .limit(Math.min(limite, 300));

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const r = row as {
      stock_id?: string;
      id?: string;
      ubicacion_id?: string;
      material_id?: string;
      cantidad_disponible?: number;
      updated_at?: string;
      material?: unknown;
      ubicacion?: unknown;
    };
    const mat = nombreMat(r.material);
    const ubiRaw = r.ubicacion;
    const ubi = Array.isArray(ubiRaw) ? ubiRaw[0] : ubiRaw;
    const dest = ubi && typeof ubi === 'object' ? String((ubi as { nombre?: string }).nombre ?? '') : '';
    const proy = nombreProy(
      ubi && typeof ubi === 'object' ? (ubi as { proyecto?: unknown }).proyecto : null,
    );

    const stockId = String(r.stock_id ?? r.id ?? '').trim();
    const ubicacionId = String(r.ubicacion_id ?? '').trim();
    const materialId = String(r.material_id ?? mat.id ?? '').trim();
    const filaId =
      stockId && /^[0-9a-f-]{36}$/i.test(stockId)
        ? `stk-${stockId}`
        : ubicacionId && materialId
          ? `stk-pair-${ubicacionId}_${materialId}`
          : '';

    if (!filaId || !movimientoInventarioEsEliminable(filaId)) return [];

    return [
      {
        id: filaId,
        tipo: 'almacenado' as const,
        fecha: String(r.updated_at ?? '').slice(0, 10),
        material_id: materialId || null,
        material_nombre: mat.name,
        material_codigo: mat.sap,
        unidad: mat.unit,
        cantidad: Number(r.cantidad_disponible ?? 0),
        proveedor: null,
        origen: null,
        destino: dest || null,
        proyecto_id: proy.id || null,
        proyecto_nombre: proy.nombre || null,
        referencia: null,
        capitulo: null,
        notas: null,
        ubicacion_id: ubicacionId || null,
        eliminable: true,
      },
    ];
  });
}

function aplicarFiltros(
  filas: FilaMovimientoInventario[],
  f: FiltrosMovimientosInventario,
): FilaMovimientoInventario[] {
  return filas.filter((r) => {
    if (f.vista && f.vista !== 'todos' && r.tipo !== f.vista) return false;
    if (f.proyectoId && r.proyecto_id !== f.proyectoId) return false;
    if (f.ubicacionId) {
      /* filtro ubicación solo en almacenado/ingreso por nombre destino — simplificado */
    }
    if (!incluye(r.proveedor ?? '', f.proveedor)) return false;
    if (!incluye(r.destino ?? '', f.destino) && !incluye(r.proyecto_nombre ?? '', f.destino)) {
      if (f.destino?.trim()) return false;
    }
    if (!incluye(r.material_nombre, f.material) && !incluye(r.material_codigo ?? '', f.material)) {
      if (f.material?.trim()) return false;
    }
    if (!enRangoFecha(r.fecha, f.fechaDesde, f.fechaHasta)) return false;
    return true;
  });
}

export async function listarMovimientosInventario(
  supabase: SupabaseClient,
  filtros: FiltrosMovimientosInventario = {},
): Promise<{
  filas: FilaMovimientoInventario[];
  resumen: { ingresado: number; despachado: number; almacenado: number };
}> {
  const limite = Math.min(Math.max(filtros.limite ?? 200, 20), 400);
  const vista = filtros.vista ?? 'todos';

  const tareas: Promise<FilaMovimientoInventario[]>[] = [];
  if (vista === 'todos' || vista === 'ingresado') {
    tareas.push(cargarIngresos(supabase, limite));
    tareas.push(cargarIngresosCuarentena(supabase, limite));
  }
  if (vista === 'todos' || vista === 'despachado') {
    tareas.push(cargarDespachosTransferencia(supabase, limite));
    tareas.push(cargarDespachosTelegram(supabase, limite));
  }
  if (vista === 'todos' || vista === 'almacenado') tareas.push(cargarAlmacenado(supabase, limite));

  const lotes = await Promise.all(tareas);
  const merged = lotes.flat().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const filas = aplicarFiltros(merged, filtros).slice(0, limite);

  const resumen = {
    ingresado: merged.filter((r) => r.tipo === 'ingreso').length,
    despachado: merged.filter((r) => r.tipo === 'despacho').length,
    almacenado: merged.filter((r) => r.tipo === 'almacenado').length,
  };

  return { filas, resumen };
}
