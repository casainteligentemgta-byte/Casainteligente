/**
 * Acceso a `registros_gastos` (histórico RANCHO / CCO V4).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateGastoCcoInput, GastoRegistro, MetricasCco } from '@/types/gastos';
import type { CcoClase, CcoLibroFila } from '@/lib/contabilidad/cco/types';
import { fetchAllRows } from '@/lib/contabilidad/cco/fetchAllRows';

export const TABLA_REGISTROS_GASTOS = 'registros_gastos';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function mapRowToGastoRegistro(row: Record<string, unknown>): GastoRegistro {
  return {
    id: (row.id as number | string) ?? '',
    clase: strOrNull(row.clase),
    fecha: row.fecha != null ? String(row.fecha) : null,
    proveedor: strOrNull(row.proveedor),
    tipo: strOrNull(row.tipo),
    capitulo: strOrNull(row.capitulo),
    subcapitulo: strOrNull(row.subcapitulo),
    descripcion: strOrNull(row.descripcion),
    contrato_vinculado: strOrNull(row.contrato_vinculado),
    moneda: strOrNull(row.moneda),
    tasa: numOrNull(row.tasa),
    monto_orig: numOrNull(row.monto_orig),
    monto_base_usd: numOrNull(row.monto_base_usd),
    monto_pagado: numOrNull(row.monto_pagado),
    forma_pago: strOrNull(row.forma_pago),
    link_factura: strOrNull(row.link_factura),
    link_comprobante: strOrNull(row.link_comprobante),
    estado: strOrNull(row.estado),
    honorarios: numOrNull(row.honorarios),
    costo_total: numOrNull(row.costo_total),
    porcentaje_admin: numOrNull(row.porcentaje_admin),
    tasa_binance: numOrNull(row.tasa_binance),
    tasa_usada: strOrNull(row.tasa_usada),
    porcentaje_brecha_real: numOrNull(row.porcentaje_brecha_real),
    pool_asignado: numOrNull(row.pool_asignado),
    avance_fisico: numOrNull(row.avance_fisico),
  };
}

export function gastoRegistroALibroFila(r: GastoRegistro): CcoLibroFila {
  const claseRaw = String(r.clase ?? 'GASTO').toUpperCase();
  const clase = (
    ['GASTO', 'INGRESO', 'CONTRATO', 'PRESUPUESTO', 'AUDITORIA'].includes(claseRaw)
      ? claseRaw
      : 'GASTO'
  ) as CcoClase;

  const fuente: CcoLibroFila['fuente'] =
    clase === 'INGRESO'
      ? 'inyeccion'
      : clase === 'CONTRATO'
        ? 'contrato'
        : clase === 'PRESUPUESTO'
          ? 'presupuesto'
          : clase === 'AUDITORIA'
            ? 'auditoria'
            : 'compra';

  return {
    id: String(r.id),
    clase,
    fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
    proveedor: r.proveedor?.trim() || 'Sin proveedor',
    tipo: r.tipo?.trim() || '—',
    capitulo: r.capitulo?.trim() || '—',
    subcapitulo: r.subcapitulo?.trim() || '—',
    descripcion: r.descripcion?.trim() || '—',
    moneda: r.moneda?.trim() || 'USD',
    monto_base_usd: num(r.monto_base_usd),
    honorarios_usd: num(r.honorarios),
    costo_total_usd: num(r.costo_total) || num(r.monto_base_usd) + num(r.honorarios),
    estado: r.estado?.trim() || '—',
    contrato_obra_id: null,
    fuente,
  };
}

export type GetGastosCcoOpts = {
  /** Filtro opcional por clase (GASTO, INGRESO, …). */
  clase?: string | null;
  /** Límite de filas (default 5000). */
  limit?: number;
  /** Offset para paginación (default 0). */
  offset?: number;
  proveedor?: string | null;
  capitulo?: string | null;
};

/**
 * Consulta `registros_gastos` ordenada por fecha descendente.
 * Sin proyecto_id en la tabla: el histórico RANCHO es global a la obra importada.
 */
export async function getGastosCCO(
  supabase: SupabaseClient,
  opts?: GetGastosCcoOpts,
): Promise<{ rows: GastoRegistro[]; total: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 5000, 1), 10_000);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const clase = opts?.clase?.trim().toUpperCase() || null;
  const proveedor = opts?.proveedor?.trim() || null;
  const capitulo = opts?.capitulo?.trim() || null;

  let countQ = supabase
    .from(TABLA_REGISTROS_GASTOS)
    .select('id', { count: 'exact', head: true });
  if (clase) countQ = countQ.eq('clase', clase);
  if (proveedor) countQ = countQ.ilike('proveedor', `%${proveedor}%`);
  if (capitulo) countQ = countQ.ilike('capitulo', `%${capitulo}%`);
  const { count, error: countErr } = await countQ;
  if (countErr) {
    if (/schema cache|does not exist|42P01/i.test(countErr.message)) {
      return { rows: [], total: 0 };
    }
    throw countErr;
  }

  const buildBase = () => {
    let q = supabase
      .from(TABLA_REGISTROS_GASTOS)
      .select('*')
      .order('fecha', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });
    if (clase) q = q.eq('clase', clase);
    if (proveedor) q = q.ilike('proveedor', `%${proveedor}%`);
    if (capitulo) q = q.ilike('capitulo', `%${capitulo}%`);
    return q;
  };

  // Paginación simple: un solo range. Carga completa: fetchAllRows.
  if (offset > 0 || limit < 5000) {
    const { data, error } = await buildBase().range(offset, offset + limit - 1);
    if (error) {
      if (/schema cache|does not exist|42P01/i.test(error.message)) {
        return { rows: [], total: 0 };
      }
      throw new Error(error.message);
    }
    return {
      rows: ((data ?? []) as Record<string, unknown>[]).map(mapRowToGastoRegistro),
      total: count ?? 0,
    };
  }

  const { data, error } = await fetchAllRows<Record<string, unknown>>(buildBase, {
    maxRows: limit,
  });
  if (error) {
    if (/schema cache|does not exist|42P01/i.test(error.message ?? '')) {
      return { rows: [], total: 0 };
    }
    throw new Error(error.message ?? 'Error al leer registros_gastos');
  }

  const rows = (data ?? []).map(mapRowToGastoRegistro);
  return { rows, total: count ?? rows.length };
}

/** Agregaciones KPI sobre `registros_gastos`. */
export async function getMetricasCCO(supabase: SupabaseClient): Promise<MetricasCco> {
  const { rows, total } = await getGastosCCO(supabase, { limit: 10_000 });

  let sumaCostoTotal = 0;
  let sumaMontoPagado = 0;
  let sumaHonorarios = 0;
  let sumaMontoBaseUsd = 0;
  let sumAvance = 0;
  let nAvance = 0;
  let countGastos = 0;
  let countIngresos = 0;

  for (const r of rows) {
    const clase = String(r.clase ?? '').toUpperCase();
    sumaCostoTotal += num(r.costo_total);
    sumaMontoPagado += num(r.monto_pagado);
    sumaHonorarios += num(r.honorarios);
    sumaMontoBaseUsd += num(r.monto_base_usd);
    if (r.avance_fisico != null && Number.isFinite(Number(r.avance_fisico))) {
      sumAvance += Number(r.avance_fisico);
      nAvance += 1;
    }
    if (clase === 'GASTO') countGastos += 1;
    if (clase === 'INGRESO') countIngresos += 1;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    totalRegistros: total,
    sumaCostoTotal: r2(sumaCostoTotal),
    sumaMontoPagado: r2(sumaMontoPagado),
    sumaHonorarios: r2(sumaHonorarios),
    promedioAvanceFisico: nAvance > 0 ? r2(sumAvance / nAvance) : null,
    sumaMontoBaseUsd: r2(sumaMontoBaseUsd),
    countGastos,
    countIngresos,
  };
}

/**
 * Inserta un registro desde el formulario CCO.
 * Calcula honorarios/costo si solo viene monto_base_usd + porcentaje_admin.
 */
export async function createGastoCCO(
  supabase: SupabaseClient,
  data: CreateGastoCcoInput,
): Promise<GastoRegistro> {
  const clase = String(data.clase ?? 'GASTO').trim().toUpperCase() || 'GASTO';
  const montoBase = num(data.monto_base_usd ?? data.monto_orig);
  const pctAdmin =
    data.porcentaje_admin != null && Number.isFinite(Number(data.porcentaje_admin))
      ? Number(data.porcentaje_admin)
      : 15;
  const honorarios =
    data.honorarios != null && Number.isFinite(Number(data.honorarios))
      ? Number(data.honorarios)
      : Math.round(montoBase * (pctAdmin / 100) * 10000) / 10000;
  const costoTotal =
    data.costo_total != null && Number.isFinite(Number(data.costo_total))
      ? Number(data.costo_total)
      : Math.round((montoBase + honorarios) * 100) / 100;

  const fechaRaw = data.fecha ? String(data.fecha).trim() : new Date().toISOString();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)
    ? `${fechaRaw}T00:00:00Z`
    : fechaRaw;

  const row = {
    clase,
    fecha,
    proveedor: strOrNull(data.proveedor),
    tipo: strOrNull(data.tipo) ?? 'MATERIALES',
    capitulo: strOrNull(data.capitulo),
    subcapitulo: strOrNull(data.subcapitulo),
    descripcion: strOrNull(data.descripcion) ?? 'Gasto',
    contrato_vinculado: strOrNull(data.contrato_vinculado),
    moneda: strOrNull(data.moneda) ?? 'USD',
    tasa: numOrNull(data.tasa) ?? 1,
    monto_orig: numOrNull(data.monto_orig) ?? montoBase,
    monto_base_usd: montoBase,
    monto_pagado: numOrNull(data.monto_pagado) ?? montoBase,
    forma_pago: strOrNull(data.forma_pago) ?? 'TRANSFERENCIA BANCARIA',
    link_factura: strOrNull(data.link_factura),
    link_comprobante: strOrNull(data.link_comprobante),
    estado: strOrNull(data.estado) ?? 'PAGADO',
    honorarios,
    costo_total: costoTotal,
    porcentaje_admin: pctAdmin,
    tasa_binance: numOrNull(data.tasa_binance),
    tasa_usada: strOrNull(data.tasa_usada) ?? 'BCV',
    porcentaje_brecha_real: numOrNull(data.porcentaje_brecha_real),
    pool_asignado: numOrNull(data.pool_asignado),
    avance_fisico: numOrNull(data.avance_fisico),
  };

  const { data: inserted, error } = await supabase
    .from(TABLA_REGISTROS_GASTOS)
    .insert(row)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRowToGastoRegistro(inserted as Record<string, unknown>);
}

/** True si la tabla tiene al menos un registro (histórico importado). */
export async function tieneRegistrosGastos(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from(TABLA_REGISTROS_GASTOS)
    .select('id', { count: 'exact', head: true });
  if (error) return false;
  return (count ?? 0) > 0;
}
