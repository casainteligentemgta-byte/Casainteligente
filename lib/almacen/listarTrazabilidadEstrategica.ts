import type { SupabaseClient } from '@supabase/supabase-js';
import type { TipoMovimientoTrazabilidadFiltro } from '@/lib/almacen/trazabilidadCuadroShare';
import {
  clasificarTipoMovimientoTrazabilidad,
  etiquetaTipoMovimientoTrazabilidad,
  resolverDestinoResponsableTrazabilidad,
  resolverOrigenDocumentoTrazabilidad,
  type ContextoEnriquecimientoTrazabilidad,
  type TipoMovimientoTrazabilidad,
} from '@/lib/almacen/trazabilidadTiposCuadro';

export type FiltrosTrazabilidadEstrategica = {
  material?: string;
  proyectoId?: string;
  tipoMovimiento?: TipoMovimientoTrazabilidadFiltro;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  pageSize?: number;
  /** Sin paginación (exportación). Máx. 5000 filas. */
  exportar?: boolean;
};

export type FilaTrazabilidadEstrategica = {
  id: string;
  fechaHora: string;
  materialId: string;
  materialNombre: string;
  materialCodigo: string | null;
  unidad: string;
  origenDocumento: string;
  origenEnlace: string | null;
  tipoMovimiento: TipoMovimientoTrazabilidad;
  tipoEtiqueta: string;
  cantidad: number;
  cantidadAbsoluta: number;
  destinoResponsable: string;
  stockResultante: number;
  /** Costo ponderado actual del material (referencial en kardex). */
  costoPromedioUsd: number;
  ubicacionNombre: string;
  proyectoId: string | null;
  proyectoNombre: string | null;
  notas: string | null;
};

export type ResultadoTrazabilidadEstrategica = {
  filas: FilaTrazabilidadEstrategica[];
  total: number;
  pagina: number;
  pageSize: number;
  totalPaginas: number;
};

type MovRowDb = {
  id: string;
  material_id: string;
  ubicacion_id: string;
  tipo_movimiento: string;
  delta_disponible: number | null;
  delta_reservada: number | null;
  delta_transito_entrante: number | null;
  created_at: string;
  notas: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  documento_id: string | null;
  material?: unknown;
  ubicacion?: unknown;
};

const SELECT_MOV =
  `
  id,
  material_id,
  ubicacion_id,
  tipo_movimiento,
  delta_disponible,
  delta_reservada,
  delta_transito_entrante,
  created_at,
  notas,
  referencia_tipo,
  referencia_id,
  documento_id,
  material:global_inventory ( id, name, unit, sap_code, average_weighted_cost ),
  ubicacion:inv_ubicaciones ( id, nombre, ci_proyecto_id, proyecto:ci_proyectos ( id, nombre ) )
`;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function nombreMat(raw: unknown): {
  id: string;
  name: string;
  unit: string;
  sap: string | null;
  costoUsd: number;
} {
  const m = Array.isArray(raw) ? raw[0] : raw;
  if (!m || typeof m !== 'object') {
    return { id: '', name: 'Material', unit: 'UND', sap: null, costoUsd: 0 };
  }
  const o = m as {
    id?: string;
    name?: string;
    unit?: string;
    sap_code?: string | null;
    average_weighted_cost?: number | null;
  };
  return {
    id: String(o.id ?? ''),
    name: String(o.name ?? 'Material'),
    unit: String(o.unit ?? 'UND'),
    sap: o.sap_code ?? null,
    costoUsd: Number(o.average_weighted_cost) || 0,
  };
}

function nombreUbi(raw: unknown): {
  id: string;
  nombre: string;
  proyectoId: string | null;
  proyectoNombre: string | null;
} {
  const u = Array.isArray(raw) ? raw[0] : raw;
  if (!u || typeof u !== 'object') {
    return { id: '', nombre: '', proyectoId: null, proyectoNombre: null };
  }
  const o = u as {
    id?: string;
    nombre?: string;
    ci_proyecto_id?: string | null;
    proyecto?: unknown;
  };
  const proyRaw = o.proyecto;
  const proy = Array.isArray(proyRaw) ? proyRaw[0] : proyRaw;
  const proyObj = proy && typeof proy === 'object' ? (proy as { id?: string; nombre?: string }) : null;
  return {
    id: String(o.id ?? ''),
    nombre: String(o.nombre ?? '').trim(),
    proyectoId: String(proyObj?.id ?? o.ci_proyecto_id ?? '').trim() || null,
    proyectoNombre: String(proyObj?.nombre ?? '').trim() || null,
  };
}

function cantidadPrincipal(m: MovRowDb): number {
  const d = Number(m.delta_disponible) || 0;
  if (d !== 0) return d;
  const r = Number(m.delta_reservada) || 0;
  if (r !== 0) return r;
  return Number(m.delta_transito_entrante) || 0;
}

function rangoFechaIso(desde?: string, hasta?: string): { desdeIso?: string; hastaIso?: string } {
  const desdeIso = desde?.trim() ? `${desde.trim().slice(0, 10)}T00:00:00.000Z` : undefined;
  const hastaIso = hasta?.trim() ? `${hasta.trim().slice(0, 10)}T23:59:59.999Z` : undefined;
  return { desdeIso, hastaIso };
}

async function resolverMaterialIds(
  supabase: SupabaseClient,
  material: string | undefined,
): Promise<string[] | null> {
  const q = material?.trim();
  if (!q) return null;
  const needle = norm(q);
  const { data, error } = await supabase
    .from('global_inventory')
    .select('id, name, sap_code')
    .or(`name.ilike.%${needle}%,sap_code.ilike.%${needle}%`)
    .limit(400);
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);
  const ids = (data ?? [])
    .filter((row) => {
      const name = norm(String((row as { name?: string }).name ?? ''));
      const sap = norm(String((row as { sap_code?: string | null }).sap_code ?? ''));
      return name.includes(needle) || sap.includes(needle);
    })
    .map((row) => String((row as { id: string }).id));
  return ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
}

async function resolverUbicacionIdsPorProyecto(
  supabase: SupabaseClient,
  proyectoId: string | undefined,
): Promise<string[] | null> {
  const pid = proyectoId?.trim();
  if (!pid) return null;
  const { data, error } = await supabase
    .from('inv_ubicaciones')
    .select('id')
    .eq('ci_proyecto_id', pid)
    .limit(500);
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => String((r as { id: string }).id));
  return ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
}

async function cargarContextoEnriquecimiento(
  supabase: SupabaseClient,
  rows: MovRowDb[],
): Promise<ContextoEnriquecimientoTrazabilidad> {
  const ctx: ContextoEnriquecimientoTrazabilidad = {
    comprasFactura: new Map(),
    recepcion: new Map(),
    transferencia: new Map(),
    contabilidadPorInvoice: new Map(),
  };

  const compraIds = new Set<string>();
  const recepcionIds = new Set<string>();
  const transferenciaIds = new Set<string>();
  const purchaseInvoiceIds = new Set<string>();

  for (const row of rows) {
    const refTipo = String(row.referencia_tipo ?? '').trim().toLowerCase();
    const refId = String(row.referencia_id ?? '').trim();
    if (!refId) continue;
    if (refTipo.includes('compras_factura') || refTipo.includes('compra')) compraIds.add(refId);
    if (refTipo.includes('recepcion')) recepcionIds.add(refId);
    if (refTipo.includes('transfer')) transferenciaIds.add(refId);
    if (refTipo === 'transferencias_inventario') transferenciaIds.add(refId);
  }

  if (compraIds.size) {
    const { data } = await supabase
      .from('compras_facturas')
      .select('id, numero_factura, purchase_invoice_id')
      .in('id', Array.from(compraIds).slice(0, 200));
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        numero_factura: string | null;
        purchase_invoice_id: string | null;
      };
      ctx.comprasFactura.set(String(r.id), {
        id: String(r.id),
        numero_factura: r.numero_factura,
        purchase_invoice_id: r.purchase_invoice_id,
        contabilidad_id: null,
      });
      if (r.purchase_invoice_id) purchaseInvoiceIds.add(String(r.purchase_invoice_id));
    }
  }

  if (purchaseInvoiceIds.size) {
    const { data } = await supabase
      .from('contabilidad_compras')
      .select('id, invoice_number, purchase_invoice_id')
      .in('purchase_invoice_id', Array.from(purchaseInvoiceIds).slice(0, 200));
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        invoice_number: string | null;
        purchase_invoice_id: string | null;
      };
      if (r.purchase_invoice_id) {
        ctx.contabilidadPorInvoice.set(String(r.purchase_invoice_id), {
          id: String(r.id),
          invoice_number: r.invoice_number,
        });
      }
    }
    for (const cf of Array.from(ctx.comprasFactura.values())) {
      if (!cf.purchase_invoice_id) continue;
      const cc = ctx.contabilidadPorInvoice.get(cf.purchase_invoice_id);
      if (cc) cf.contabilidad_id = cc.id;
    }
  }

  if (recepcionIds.size) {
    const { data } = await supabase
      .from('ci_recepciones_campo')
      .select(
        `
        id,
        num_doc,
        tipo,
        observaciones,
        proyecto:ci_proyectos ( nombre )
      `,
      )
      .in('id', Array.from(recepcionIds).slice(0, 200));
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        num_doc: string | null;
        tipo: string | null;
        observaciones: string | null;
        proyecto?: unknown;
      };
      const proy = Array.isArray(r.proyecto) ? r.proyecto[0] : r.proyecto;
      ctx.recepcion.set(String(r.id), {
        id: String(r.id),
        num_doc: r.num_doc,
        tipo: r.tipo,
        observaciones: r.observaciones,
        proyecto_nombre:
          proy && typeof proy === 'object'
            ? String((proy as { nombre?: string }).nombre ?? '').trim() || null
            : null,
        forma_ingreso: null,
      });
    }
  }

  if (transferenciaIds.size) {
    const { data } = await supabase
      .from('transferencias_inventario')
      .select(
        `
        id,
        codigo,
        tipo_movimiento,
        observaciones,
        origen:inv_ubicaciones!transferencias_inventario_origen_ubicacion_id_fkey ( nombre ),
        destino:inv_ubicaciones!transferencias_inventario_destino_ubicacion_id_fkey ( nombre ),
        proyecto:ci_proyectos ( nombre )
      `,
      )
      .in('id', Array.from(transferenciaIds).slice(0, 200));
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        codigo: string | null;
        tipo_movimiento: string | null;
        observaciones: string | null;
        origen?: unknown;
        destino?: unknown;
        proyecto?: unknown;
      };
      const origen = Array.isArray(r.origen) ? r.origen[0] : r.origen;
      const destino = Array.isArray(r.destino) ? r.destino[0] : r.destino;
      const proy = Array.isArray(r.proyecto) ? r.proyecto[0] : r.proyecto;
      ctx.transferencia.set(String(r.id), {
        id: String(r.id),
        codigo: r.codigo,
        tipo_movimiento: r.tipo_movimiento,
        observaciones: r.observaciones,
        origen_nombre:
          origen && typeof origen === 'object'
            ? String((origen as { nombre?: string }).nombre ?? '').trim() || null
            : null,
        destino_nombre:
          destino && typeof destino === 'object'
            ? String((destino as { nombre?: string }).nombre ?? '').trim() || null
            : null,
        proyecto_nombre:
          proy && typeof proy === 'object'
            ? String((proy as { nombre?: string }).nombre ?? '').trim() || null
            : null,
      });
    }
  }

  return ctx;
}

async function calcularStockResultanteBatch(
  supabase: SupabaseClient,
  rows: MovRowDb[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!rows.length) return out;

  const ids = rows.map((r) => r.id);
  const { data, error } = await supabase.rpc('ci_stock_resultante_por_movimientos', {
    p_movimiento_ids: ids,
  });

  if (!error && data) {
    for (const row of data as Array<{ movimiento_id: string; stock_resultante: number }>) {
      out.set(String(row.movimiento_id), Number(row.stock_resultante) || 0);
    }
    return out;
  }

  const grupos = new Map<string, MovRowDb[]>();
  for (const row of rows) {
    const k = `${row.material_id}|${row.ubicacion_id}`;
    const prev = grupos.get(k) ?? [];
    prev.push(row);
    grupos.set(k, prev);
  }

  for (const [clave, filasGrupo] of Array.from(grupos.entries())) {
    const [materialId, ubicacionId] = clave.split('|');
    const maxTs = filasGrupo.reduce(
      (acc, r) => (r.created_at > acc ? r.created_at : acc),
      filasGrupo[0].created_at,
    );

    const { data: hist, error: histErr } = await supabase
      .from('inv_movimientos')
      .select('id, delta_disponible, delta_reservada, delta_transito_entrante, created_at')
      .eq('material_id', materialId)
      .eq('ubicacion_id', ubicacionId)
      .lte('created_at', maxTs)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(5000);

    if (histErr) continue;

    let acum = 0;
    const porId = new Map<string, number>();
    for (const h of hist ?? []) {
      const d = Number((h as { delta_disponible?: number }).delta_disponible) || 0;
      const r = Number((h as { delta_reservada?: number }).delta_reservada) || 0;
      const t = Number((h as { delta_transito_entrante?: number }).delta_transito_entrante) || 0;
      acum += d !== 0 ? d : r !== 0 ? r : t;
      porId.set(String((h as { id: string }).id), Math.round(acum * 10000) / 10000);
    }

    for (const f of filasGrupo) {
      const v = porId.get(f.id);
      if (v != null) out.set(f.id, v);
    }
  }

  return out;
}

function mapearFila(
  row: MovRowDb,
  ctx: ContextoEnriquecimientoTrazabilidad,
  stockMap: Map<string, number>,
): FilaTrazabilidadEstrategica {
  const mat = nombreMat(row.material);
  const ubi = nombreUbi(row.ubicacion);
  const qty = cantidadPrincipal(row);
  const tipo = clasificarTipoMovimientoTrazabilidad(row, ctx);
  const origen = resolverOrigenDocumentoTrazabilidad(row, ctx, ubi.nombre, tipo);

  return {
    id: row.id,
    fechaHora: row.created_at,
    materialId: row.material_id,
    materialNombre: mat.name,
    materialCodigo: mat.sap,
    unidad: mat.unit,
    origenDocumento: origen.texto,
    origenEnlace: origen.enlace,
    tipoMovimiento: tipo,
    tipoEtiqueta: etiquetaTipoMovimientoTrazabilidad(tipo),
    cantidad: qty,
    cantidadAbsoluta: Math.abs(qty),
    destinoResponsable: resolverDestinoResponsableTrazabilidad(
      row,
      ctx,
      ubi.nombre,
      ubi.proyectoNombre,
      tipo,
    ),
    stockResultante: stockMap.get(row.id) ?? 0,
    costoPromedioUsd: mat.costoUsd,
    ubicacionNombre: ubi.nombre,
    proyectoId: ubi.proyectoId,
    proyectoNombre: ubi.proyectoNombre,
    notas: row.notas?.trim() || null,
  };
}

async function consultarMovimientosBase(
  supabase: SupabaseClient,
  filtros: FiltrosTrazabilidadEstrategica,
  opts: { offset: number; limit: number; countOnly?: boolean },
): Promise<{ rows: MovRowDb[]; total: number }> {
  const { desdeIso, hastaIso } = rangoFechaIso(filtros.fechaDesde, filtros.fechaHasta);
  const materialIds = await resolverMaterialIds(supabase, filtros.material);
  const ubicacionIds = await resolverUbicacionIdsPorProyecto(supabase, filtros.proyectoId);

  let q = supabase
    .from('inv_movimientos')
    .select(SELECT_MOV, opts.countOnly ? { count: 'exact', head: true } : { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (materialIds) q = q.in('material_id', materialIds);
  if (ubicacionIds) q = q.in('ubicacion_id', ubicacionIds);
  if (desdeIso) q = q.gte('created_at', desdeIso);
  if (hastaIso) q = q.lte('created_at', hastaIso);

  if (opts.countOnly) {
    const { count, error } = await q;
    if (error) {
      if (error.code === '42P01') {
        throw new Error('Ledger inv_movimientos no disponible. Aplique migración 203 en Supabase.');
      }
      throw new Error(error.message);
    }
    return { rows: [], total: count ?? 0 };
  }

  const { data, count, error } = await q.range(opts.offset, opts.offset + opts.limit - 1);
  if (error) {
    if (error.code === '42P01') {
      throw new Error('Ledger inv_movimientos no disponible. Aplique migración 203 en Supabase.');
    }
    throw new Error(error.message);
  }

  return { rows: (data ?? []) as MovRowDb[], total: count ?? 0 };
}

export async function listarTrazabilidadEstrategica(
  supabase: SupabaseClient,
  filtros: FiltrosTrazabilidadEstrategica = {},
): Promise<ResultadoTrazabilidadEstrategica> {
  const pageSize = Math.min(Math.max(filtros.pageSize ?? 50, 10), filtros.exportar ? 5000 : 200);
  const pagina = Math.max(filtros.pagina ?? 1, 1);
  const tipoFiltro = filtros.tipoMovimiento ?? '';

  if (tipoFiltro) {
    const ventana = filtros.exportar ? 5000 : Math.max(pageSize * 4, 200);
    const { rows: candidatas, total: totalSinTipo } = await consultarMovimientosBase(supabase, filtros, {
      offset: filtros.exportar ? 0 : (pagina - 1) * pageSize,
      limit: filtros.exportar ? 5000 : ventana,
    });

    const ctx = await cargarContextoEnriquecimiento(supabase, candidatas);
    const stockMap = await calcularStockResultanteBatch(supabase, candidatas);
    const filtradas = candidatas
      .map((row) => mapearFila(row, ctx, stockMap))
      .filter((f) => f.tipoMovimiento === tipoFiltro);

    if (filtros.exportar) {
      return {
        filas: filtradas.slice(0, 5000),
        total: filtradas.length,
        pagina: 1,
        pageSize: filtradas.length,
        totalPaginas: 1,
      };
    }

    const total = filtradas.length;
    const inicio = (pagina - 1) * pageSize;
    const paginaFilas = filtradas.slice(inicio, inicio + pageSize);

    return {
      filas: paginaFilas,
      total: total || totalSinTipo,
      pagina,
      pageSize,
      totalPaginas: Math.max(1, Math.ceil((total || 1) / pageSize)),
    };
  }

  const offset = filtros.exportar ? 0 : (pagina - 1) * pageSize;
  const limit = filtros.exportar ? 5000 : pageSize;
  const { rows, total } = await consultarMovimientosBase(supabase, filtros, { offset, limit });
  const ctx = await cargarContextoEnriquecimiento(supabase, rows);
  const stockMap = await calcularStockResultanteBatch(supabase, rows);
  const filas = rows.map((row) => mapearFila(row, ctx, stockMap));

  return {
    filas,
    total,
    pagina: filtros.exportar ? 1 : pagina,
    pageSize: filas.length || pageSize,
    totalPaginas: Math.max(1, Math.ceil(total / pageSize)),
  };
}
