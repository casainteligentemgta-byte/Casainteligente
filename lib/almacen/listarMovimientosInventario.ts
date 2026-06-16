import type { SupabaseClient } from '@supabase/supabase-js';
import { movimientoInventarioEsEliminable } from '@/lib/almacen/eliminarMovimientoInventario';
import {
  enriquecerFilasProyecto,
  filaCoincideProyectosEntidad,
  proyectoDesdeUbicacionRow,
  type ProyectoRef,
} from '@/lib/almacen/resolverProyectoMovimiento';

export type VistaMovimientoInventario = 'ingresado' | 'despachado' | 'almacenado' | 'todos';

export type FiltrosMovimientosInventario = {
  vista?: VistaMovimientoInventario;
  proveedor?: string;
  destino?: string;
  proyectoId?: string;
  /** Obras de la entidad cuando no hay proyecto concreto. */
  proyectoIdsEntidad?: string[];
  /** Restringir a materiales del catálogo (p. ej. categoría EPP). */
  materialIdsCategoria?: string[];
  ubicacionId?: string;
  /** Varias ubicaciones (p. ej. almacén / depósito filtrado). */
  ubicacionIds?: string[];
  fechaDesde?: string;
  fechaHasta?: string;
  material?: string;
  limite?: number;
};

export type FilaMovimientoInventario = {
  id: string;
  tipo: 'ingreso' | 'despacho' | 'almacenado';
  fecha: string;
  hora: string | null;
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

const SELECT_MATERIAL_MOV = `
  id, name, unit, sap_code,
  proyecto_id,
  proyecto:ci_proyectos ( id, nombre )
`;

async function cargarProyectosCatalogo(supabase: SupabaseClient): Promise<ProyectoRef[]> {
  const { data, error } = await supabase.from('ci_proyectos').select('id,nombre').order('nombre');
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: String(p.id),
    nombre: String(p.nombre ?? '').trim() || String(p.id),
  }));
}

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

function tipoParaVista(vista: VistaMovimientoInventario): FilaMovimientoInventario['tipo'] | null {
  if (vista === 'ingresado') return 'ingreso';
  if (vista === 'despachado') return 'despacho';
  if (vista === 'almacenado') return 'almacenado';
  return null;
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

function parseFechaHora(
  primario?: string | null,
  fallbackConHora?: string | null,
): { fecha: string; hora: string | null } {
  const conHora = String(fallbackConHora ?? '').trim();
  if (conHora.length > 10) {
    const d = new Date(conHora);
    if (!Number.isNaN(d.getTime())) {
      return {
        fecha: conHora.slice(0, 10),
        hora: d.toLocaleTimeString('es-VE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      };
    }
  }
  const fecha = String(primario ?? conHora ?? '').slice(0, 10);
  return { fecha, hora: null };
}

function etiquetaTipoRecepcionCampo(tipo: string, observaciones?: string | null): string {
  const obs = String(observaciones ?? '');
  if (obs.includes('Origen: ingreso manual')) return 'Ingreso manual';
  if (obs.includes('Origen: nota de entrega')) return 'Nota de entrega';
  if (obs.includes('Origen: emergencia')) return 'Emergencia (sin papeles)';

  switch (String(tipo ?? '').trim().toLowerCase()) {
    case 'emergencia':
      return 'Emergencia (sin papeles)';
    case 'factura_canal':
      return 'Factura en tránsito';
    case 'nota_entrega':
    default:
      return 'Ingreso manual / nota de entrega';
  }
}

async function cargarIngresosRecepcionCampo(
  supabase: SupabaseClient,
  limite: number,
): Promise<FilaMovimientoInventario[]> {
  const { data, error } = await supabase
    .from('ci_recepciones_campo')
    .select(
      `
      id,
      tipo,
      num_doc,
      proveedor_nombre,
      observaciones,
      created_at,
      proyecto_id,
      ubicacion_id,
      proyecto:ci_proyectos ( id, nombre ),
      ubicacion:inv_ubicaciones ( id, nombre ),
      lineas:ci_recepciones_campo_lineas (
        id,
        cantidad,
        unidad,
        descripcion,
        material:global_inventory ( ${SELECT_MATERIAL_MOV} )
      )
    `,
    )
    .eq('estado', 'registrado')
    .order('created_at', { ascending: false })
    .limit(Math.min(limite, 150));

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  const filas: FilaMovimientoInventario[] = [];
  for (const rec of data ?? []) {
    const proy = nombreProy(rec.proyecto);
    const proyId = proy.id || String(rec.proyecto_id ?? '') || null;
    const proyNombre = proy.nombre || null;
    const dest = nombreUbi(rec.ubicacion);
    const ubicacionId = String(rec.ubicacion_id ?? '') || null;
    const { fecha, hora } = parseFechaHora(null, rec.created_at);
    const tipoLabel = etiquetaTipoRecepcionCampo(String(rec.tipo ?? ''), rec.observaciones);
    const obs = String(rec.observaciones ?? '').trim();
    const notasBase = tipoLabel + (obs ? ` · ${obs.slice(0, 200)}` : '');

    const lineas = (rec.lineas ?? []) as Array<{
      id: string;
      cantidad: number;
      unidad: string;
      descripcion: string;
      material: unknown;
    }>;

    for (const ln of lineas) {
      const lineaId = String(ln.id ?? '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(lineaId)) continue;

      const mat = nombreMat(ln.material);
      const recepcionId = String(rec.id ?? '').trim();
      const filaId = `ing-rc-${recepcionId}_${lineaId}`;

      filas.push({
        id: filaId,
        tipo: 'ingreso',
        fecha,
        hora,
        material_id: mat.id || null,
        material_nombre: mat.name || ln.descripcion || 'Material',
        material_codigo: mat.sap,
        unidad: String(ln.unidad ?? mat.unit ?? 'UND'),
        cantidad: Number(ln.cantidad ?? 0),
        proveedor: String(rec.proveedor_nombre ?? '').trim() || null,
        origen: null,
        destino: dest || null,
        proyecto_id: proyId,
        proyecto_nombre: proyNombre,
        referencia: String(rec.num_doc ?? '').trim() || null,
        capitulo: null,
        notas: notasBase,
        ubicacion_id: ubicacionId,
        eliminable: movimientoInventarioEsEliminable(filaId),
      });
    }
  }
  return filas;
}

async function cargarIngresos(
  supabase: SupabaseClient,
  limite: number,
  proyectos: ProyectoRef[],
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
      purchase_invoice_id,
      ubicacion:inv_ubicaciones ( id, nombre, ci_proyecto_id, proyecto:ci_proyectos ( id, nombre ) ),
      lineas:compras_factura_lineas (
        id,
        cantidad,
        descripcion,
        material:global_inventory ( ${SELECT_MATERIAL_MOV} )
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
    const proy = proyectoDesdeUbicacionRow(ubi, proyectos);
    const { fecha, hora } = parseFechaHora(fac.fecha_emision, fac.created_at);
    const esFacturaTransito = Boolean(fac.purchase_invoice_id);
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
        hora,
        material_id: null,
        material_nombre: '(cabecera sin líneas contables)',
        material_codigo: null,
        unidad: 'UND',
        cantidad: 0,
        proveedor: String(fac.proveedor_nombre ?? ''),
        origen: null,
        destino: dest || null,
        proyecto_id: proy?.id || null,
        proyecto_nombre: proy?.nombre || null,
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
        hora,
        material_id: mat.id || null,
        material_nombre: mat.name || ln.descripcion || 'Material',
        material_codigo: mat.sap,
        unidad: mat.unit,
        cantidad: Number(ln.cantidad ?? 0),
        proveedor: String(fac.proveedor_nombre ?? ''),
        origen: null,
        destino: dest || null,
        proyecto_id: proy?.id || null,
        proyecto_nombre: proy?.nombre || null,
        referencia: String(fac.numero_factura ?? ''),
        capitulo: null,
        notas: esFacturaTransito ? 'Factura en tránsito / compra registrada' : null,
        ubicacion_id: String(fac.ubicacion_destino_id ?? '') || null,
        eliminable: movimientoInventarioEsEliminable(filaId),
      });
    }
  }
  return filas;
}

async function cargarIngresosCuarentena(
  supabase: SupabaseClient,
  limite: number,
  proyectos: ProyectoRef[],
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
          ci_proyecto_id,
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
    const proy = proyectoDesdeUbicacionRow(ubi, proyectos);
    const filaId = `ing-pd-${invoiceId}_${detailId}`;

    const { fecha, hora } = parseFechaHora(inv?.date, inv?.date);
    filas.push({
      id: filaId,
      tipo: 'ingreso',
      fecha: fecha || new Date().toISOString().slice(0, 10),
      hora,
      material_id: mat.id || String(row.material_id ?? '') || null,
      material_nombre: mat.name || String(row.description ?? 'Material'),
      material_codigo: mat.sap,
      unidad: mat.unit,
      cantidad: Number(row.quantity ?? 0),
      proveedor: String(inv?.supplier_name ?? ''),
      origen: null,
      destino: nombreUbi(ubi) || null,
      proyecto_id: proy?.id || null,
      proyecto_nombre: proy?.nombre || null,
      referencia: String(inv?.invoice_number ?? ''),
      capitulo: null,
      notas: 'Factura en tránsito (pendiente de recepción física)',
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
      origen_ubicacion_id,
      proyecto:ci_proyectos ( id, nombre ),
      origen:inv_ubicaciones!transferencias_inventario_origen_ubicacion_id_fkey ( id, nombre ),
      destino:inv_ubicaciones!transferencias_inventario_destino_ubicacion_id_fkey ( nombre ),
      lineas:transferencias_inventario_lineas (
        id,
        cantidad,
        material:global_inventory ( ${SELECT_MATERIAL_MOV} ),
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
    const { fecha, hora } = parseFechaHora(null, tr.despachado_at ?? tr.created_at);
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
        hora,
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
        ubicacion_id: String(tr.origen_ubicacion_id ?? '') || null,
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
    const { fecha, hora } = parseFechaHora(null, m.created_at);
    return {
      id: filaId,
      tipo: 'despacho' as const,
      fecha,
      hora,
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

type AcumuladoStock = {
  material_id: string;
  material_nombre: string;
  material_codigo: string | null;
  unidad: string;
  ubicacion_id: string;
  destino: string | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  ingresado: number;
  salido: number;
};

function claveStock(materialId: string, ubicacionId: string): string {
  return `${materialId}|${ubicacionId}`;
}

/** Stock = Σ ingresos − Σ salidas por material y ubicación (cuadro de movimientos). */
export function calcularFilasStock(
  ingresos: FilaMovimientoInventario[],
  despachos: FilaMovimientoInventario[],
): FilaMovimientoInventario[] {
  const map = new Map<string, AcumuladoStock>();

  for (const r of ingresos) {
    if (!r.material_id || r.cantidad <= 0 || !r.ubicacion_id) continue;
    const k = claveStock(r.material_id, r.ubicacion_id);
    const prev = map.get(k);
    if (prev) {
      prev.ingresado += r.cantidad;
    } else {
      map.set(k, {
        material_id: r.material_id,
        material_nombre: r.material_nombre,
        material_codigo: r.material_codigo,
        unidad: r.unidad,
        ubicacion_id: r.ubicacion_id,
        destino: r.destino,
        proyecto_id: r.proyecto_id,
        proyecto_nombre: r.proyecto_nombre,
        ingresado: r.cantidad,
        salido: 0,
      });
    }
  }

  for (const r of despachos) {
    if (!r.material_id || r.cantidad <= 0 || !r.ubicacion_id) continue;
    const k = claveStock(r.material_id, r.ubicacion_id);
    const prev = map.get(k);
    if (prev) {
      prev.salido += r.cantidad;
    } else {
      map.set(k, {
        material_id: r.material_id,
        material_nombre: r.material_nombre,
        material_codigo: r.material_codigo,
        unidad: r.unidad,
        ubicacion_id: r.ubicacion_id,
        destino: r.destino ?? r.origen,
        proyecto_id: r.proyecto_id,
        proyecto_nombre: r.proyecto_nombre,
        ingresado: 0,
        salido: r.cantidad,
      });
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  return Array.from(map.values())
    .filter((agg) => agg.ingresado - agg.salido > 0)
    .map((agg) => {
      const stock = agg.ingresado - agg.salido;
      return {
        id: `stk-calc-${agg.ubicacion_id}_${agg.material_id}`,
        tipo: 'almacenado' as const,
        fecha: hoy,
        hora: null,
        material_id: agg.material_id,
        material_nombre: agg.material_nombre,
        material_codigo: agg.material_codigo,
        unidad: agg.unidad,
        cantidad: stock,
        proveedor: null,
        origen: null,
        destino: agg.destino,
        proyecto_id: agg.proyecto_id,
        proyecto_nombre: agg.proyecto_nombre,
        referencia: null,
        capitulo: null,
        notas: `Ingresado ${agg.ingresado} − Salido ${agg.salido}`,
        ubicacion_id: agg.ubicacion_id,
        eliminable: false,
      } satisfies FilaMovimientoInventario;
    })
    .sort((a, b) => b.cantidad - a.cantidad);
}

function aplicarFiltros(
  filas: FilaMovimientoInventario[],
  f: FiltrosMovimientosInventario,
  proyectos: ProyectoRef[],
): FilaMovimientoInventario[] {
  const tipoVista = f.vista ? tipoParaVista(f.vista) : null;

  return filas.filter((r) => {
    if (tipoVista && r.tipo !== tipoVista) return false;
    if (f.proyectoId) {
      if (!filaCoincideProyectosEntidad(r, [f.proyectoId], proyectos)) return false;
    } else if (f.proyectoIdsEntidad?.length) {
      if (!filaCoincideProyectosEntidad(r, f.proyectoIdsEntidad, proyectos)) return false;
    }

    if (f.materialIdsCategoria?.length) {
      if (!r.material_id || !f.materialIdsCategoria.includes(r.material_id)) return false;
    }

    if (f.ubicacionIds?.length) {
      if (!r.ubicacion_id || !f.ubicacionIds.includes(r.ubicacion_id)) return false;
    } else if (f.ubicacionId?.trim()) {
      if (r.ubicacion_id !== f.ubicacionId.trim()) return false;
    }

    if (f.proveedor?.trim() && !incluye(r.proveedor ?? '', f.proveedor)) return false;

    if (f.destino?.trim()) {
      const matchDestino =
        incluye(r.destino ?? '', f.destino) ||
        incluye(r.origen ?? '', f.destino) ||
        incluye(r.proyecto_nombre ?? '', f.destino);
      if (!matchDestino) return false;
    }

    if (f.material?.trim()) {
      const matchMaterial =
        incluye(r.material_nombre, f.material) ||
        incluye(r.material_codigo ?? '', f.material) ||
        incluye(r.referencia ?? '', f.material);
      if (!matchMaterial) return false;
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
  const proyectos = await cargarProyectosCatalogo(supabase);

  const [
    ingresosFacturas,
    ingresosCuarentena,
    ingresosRecepcionCampo,
    despachosTransferencia,
    despachosTelegram,
  ] = await Promise.all([
    cargarIngresos(supabase, limite, proyectos),
    cargarIngresosCuarentena(supabase, limite, proyectos),
    cargarIngresosRecepcionCampo(supabase, limite),
    cargarDespachosTransferencia(supabase, limite),
    cargarDespachosTelegram(supabase, limite),
  ]);

  const todosIngresos = enriquecerFilasProyecto(
    [...ingresosFacturas, ...ingresosCuarentena, ...ingresosRecepcionCampo].sort((a, b) =>
      b.fecha.localeCompare(a.fecha),
    ),
    proyectos,
  );
  const todosDespachos = enriquecerFilasProyecto(
    [...despachosTransferencia, ...despachosTelegram].sort((a, b) =>
      b.fecha.localeCompare(a.fecha),
    ),
    proyectos,
  );
  const filasStock = enriquecerFilasProyecto(
    calcularFilasStock(todosIngresos, todosDespachos),
    proyectos,
  );

  let merged: FilaMovimientoInventario[];
  if (vista === 'ingresado') merged = todosIngresos;
  else if (vista === 'despachado') merged = todosDespachos;
  else if (vista === 'almacenado') merged = filasStock;
  else merged = [...todosIngresos, ...todosDespachos];

  const filtradas = aplicarFiltros(merged, filtros, proyectos);
  const filas = filtradas.slice(0, limite);

  const filtrosResumen = { ...filtros, vista: undefined as VistaMovimientoInventario | undefined };
  const ingresosResumen = aplicarFiltros(todosIngresos, filtrosResumen, proyectos);
  const despachosResumen = aplicarFiltros(todosDespachos, filtrosResumen, proyectos);
  const stockResumen = aplicarFiltros(filasStock, filtrosResumen, proyectos);

  const resumen = {
    ingresado: ingresosResumen.length,
    despachado: despachosResumen.length,
    almacenado: stockResumen.length,
  };

  return { filas, resumen };
}
