import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CcoContratoConSaldo,
  CcoContratoObra,
  CcoPagoVinculado,
  CcoProveedorContratos,
} from '@/lib/contabilidad/cco/types';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import { sugeridoPagarPorAvance } from '@/lib/contabilidad/cco/conciliacionContratos';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampPct(v: unknown): number {
  const n = num(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapContrato(row: Record<string, unknown>): CcoContratoObra {
  return {
    id: String(row.id),
    proyecto_id: String(row.proyecto_id),
    proveedor: String(row.proveedor ?? '').trim() || 'Sin proveedor',
    descripcion: String(row.descripcion ?? '').trim() || 'Contrato',
    fecha: row.fecha != null ? String(row.fecha).slice(0, 10) : null,
    moneda: String(row.moneda ?? 'USD'),
    monto_base_usd: num(row.monto_base_usd),
    admin_pct: num(row.admin_pct),
    honorarios_usd: num(row.honorarios_usd),
    costo_total_usd: num(row.costo_total_usd),
    estado: String(row.estado ?? 'PENDIENTE'),
    tipo_gasto_cco: row.tipo_gasto_cco != null ? String(row.tipo_gasto_cco) : null,
    origen_v4_id: row.origen_v4_id != null ? num(row.origen_v4_id) : null,
    pct_avance: clampPct(row.pct_avance),
  };
}

/** Sugerido a pagar desde el saco según avance del operador. */
export function sugeridoPagarContrato(contrato: CcoContratoConSaldo): number {
  return sugeridoPagarPorAvance(
    contrato.costo_total_usd,
    contrato.pct_avance,
    contrato.monto_pagado_usd,
  );
}

export function enriquecerContratoConPagos(
  contrato: CcoContratoObra,
  pagos: CcoPagoVinculado[],
): CcoContratoConSaldo {
  const monto_pagado_usd = pagos.reduce((a, p) => a + p.monto_usd, 0);
  const saldo_usd = Math.max(0, contrato.costo_total_usd - monto_pagado_usd);
  return {
    ...contrato,
    monto_pagado_usd,
    saldo_usd,
    pct_avance: clampPct(contrato.pct_avance),
    pagos,
  };
}

export function agruparPorProveedor(contratos: CcoContratoConSaldo[]): CcoProveedorContratos[] {
  const map = new Map<string, CcoContratoConSaldo[]>();
  for (const c of contratos) {
    const k = c.proveedor.toUpperCase();
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  return Array.from(map.entries())
    .map(([, list]) => {
      const proveedor = list[0]?.proveedor ?? 'Sin proveedor';
      const total_contratado = list.reduce((a, c) => a + c.costo_total_usd, 0);
      const total_pagado = list.reduce((a, c) => a + c.monto_pagado_usd, 0);
      return {
        proveedor,
        contratos: list.sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')),
        total_contratado,
        total_pagado,
        total_saldo: Math.max(0, total_contratado - total_pagado),
      };
    })
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es'));
}

export async function cargarJerarquiaContratos(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<{
  porProveedor: CcoProveedorContratos[];
  huerfanos: CcoPagoVinculado[];
  resumen: { contratos: number; contratado: number; pagado: number; saldo: number };
}> {
  const { data: contratosRows, error: cErr } = await supabase
    .from('cco_contratos_obra')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('proveedor')
    .order('descripcion');

  if (cErr) throw cErr;

  const contratos = (contratosRows ?? []).map((r) => mapContrato(r as Record<string, unknown>));
  const ids = contratos.map((c) => c.id);

  let pagosRows: Record<string, unknown>[] = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .select(
        'id,fecha,supplier_name,notas,monto_usd,tipo_gasto_cco,capitulo_cco,cco_estado,contrato_obra_id,invoice_number',
      )
      .eq('proyecto_id', proyectoId)
      .in('contrato_obra_id', ids)
      .limit(8000);
    if (error) throw error;
    pagosRows = (data ?? []) as Record<string, unknown>[];
  }

  const { data: huerfanosRaw, error: hErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id,fecha,supplier_name,notas,monto_usd,tipo_gasto_cco,capitulo_cco,cco_estado,contrato_obra_id,invoice_number',
    )
    .eq('proyecto_id', proyectoId)
    .is('contrato_obra_id', null)
    .or('tipo_gasto_cco.eq.CONTRATISTA,tipo_gasto_cco.eq.CONTRATO')
    .order('fecha', { ascending: false })
    .limit(500);

  if (hErr && !/tipo_gasto_cco|contrato_obra_id|schema cache/i.test(hErr.message ?? '')) {
    throw hErr;
  }

  const toPago = (row: Record<string, unknown>): CcoPagoVinculado => ({
    id: String(row.id),
    fecha: row.fecha != null ? String(row.fecha).slice(0, 10) : null,
    proveedor: String(row.supplier_name ?? '').trim() || 'Sin proveedor',
    descripcion:
      String(row.notas ?? '').trim() ||
      String(row.invoice_number ?? '').trim() ||
      'Pago',
    monto_usd: num(row.monto_usd),
    tipo_gasto_cco: row.tipo_gasto_cco != null ? String(row.tipo_gasto_cco) : null,
    capitulo_cco: row.capitulo_cco != null ? String(row.capitulo_cco) : null,
    estado: row.cco_estado != null ? String(row.cco_estado) : null,
  });

  const pagosPorContrato = new Map<string, CcoPagoVinculado[]>();
  for (const row of pagosRows) {
    const cid = String(row.contrato_obra_id ?? '');
    if (!cid) continue;
    if (!pagosPorContrato.has(cid)) pagosPorContrato.set(cid, []);
    pagosPorContrato.get(cid)!.push(toPago(row));
  }

  const enriquecidos = contratos.map((c) =>
    enriquecerContratoConPagos(c, pagosPorContrato.get(c.id) ?? []),
  );
  const porProveedor = agruparPorProveedor(enriquecidos);
  const huerfanos = (huerfanosRaw ?? []).map((r) => toPago(r as Record<string, unknown>));

  const contratado = enriquecidos.reduce((a, c) => a + c.costo_total_usd, 0);
  const pagado = enriquecidos.reduce((a, c) => a + c.monto_pagado_usd, 0);

  return {
    porProveedor,
    huerfanos,
    resumen: {
      contratos: enriquecidos.length,
      contratado,
      pagado,
      saldo: Math.max(0, contratado - pagado),
    },
  };
}

export async function upsertContratoObra(
  supabase: SupabaseClient,
  input: {
    id?: string;
    proyecto_id: string;
    proveedor: string;
    descripcion: string;
    fecha?: string | null;
    monto_base_usd: number;
    admin_pct?: number | null;
    pct_global?: number;
    estado?: string;
    tipo_gasto_cco?: string | null;
    origen_v4_id?: number | null;
    pct_avance?: number | null;
  },
): Promise<CcoContratoObra> {
  const pctGlobal = input.pct_global ?? 15;
  const calc = aplicarHonorariosABase(input.monto_base_usd, input.admin_pct, pctGlobal);
  const payload: Record<string, unknown> = {
    proyecto_id: input.proyecto_id,
    proveedor: input.proveedor.trim(),
    descripcion: input.descripcion.trim(),
    fecha: input.fecha?.slice(0, 10) || null,
    moneda: 'USD',
    monto_base_usd: input.monto_base_usd,
    admin_pct: calc.adminPct,
    honorarios_usd: calc.honorariosUsd,
    costo_total_usd: calc.costoTotalUsd,
    estado: input.estado ?? 'PENDIENTE',
    tipo_gasto_cco: input.tipo_gasto_cco ?? 'CONTRATO',
    origen_v4_id: input.origen_v4_id ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.pct_avance != null) {
    payload.pct_avance = clampPct(input.pct_avance);
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('cco_contratos_obra')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapContrato(data as Record<string, unknown>);
  }

  if (payload.pct_avance == null) payload.pct_avance = 0;

  const { data, error } = await supabase
    .from('cco_contratos_obra')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapContrato(data as Record<string, unknown>);
}

/** Actualiza solo el % de avance del operador. */
export async function patchPctAvanceContrato(
  supabase: SupabaseClient,
  contratoId: string,
  pctAvance: number,
): Promise<CcoContratoObra> {
  const { data, error } = await supabase
    .from('cco_contratos_obra')
    .update({
      pct_avance: clampPct(pctAvance),
      updated_at: new Date().toISOString(),
    })
    .eq('id', contratoId)
    .select('*')
    .single();
  if (error) throw error;
  return mapContrato(data as Record<string, unknown>);
}

/**
 * Vincula pagos huérfanos a un contrato.
 * Solo toca filas con contrato_obra_id IS NULL (no roba vínculos previos).
 */
export async function vincularPagosAContrato(
  supabase: SupabaseClient,
  contratoId: string,
  compraIds: string[],
): Promise<number> {
  if (!compraIds.length) return 0;
  const { data, error } = await supabase
    .from('contabilidad_compras')
    .update({ contrato_obra_id: contratoId, updated_at: new Date().toISOString() })
    .in('id', compraIds)
    .is('contrato_obra_id', null)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

export type AsignacionSaco = { contrato_id: string; monto_usd: number };

/**
 * Reparte un pago huérfano (saco) en uno o varios contratos.
 * - Asignación = total del huérfano → solo vincula (1:1).
 * - Parcial / varias → crea filas vinculadas y reduce el resto en el saco.
 * Nunca modifica pagos que ya tengan contrato_obra_id.
 */
export async function repartirSacoHuerfano(
  supabase: SupabaseClient,
  input: {
    compra_id: string;
    asignaciones: AsignacionSaco[];
  },
): Promise<{
  vinculados: number;
  creados: string[];
  resto_usd: number;
  compra_id: string | null;
  proyecto_id: string;
}> {
  const compraId = String(input.compra_id ?? '').trim();
  const asignaciones = (input.asignaciones ?? [])
    .map((a) => ({
      contrato_id: String(a.contrato_id ?? '').trim(),
      monto_usd: round2(Number(a.monto_usd)),
    }))
    .filter((a) => a.contrato_id && a.monto_usd > 0);

  if (!compraId || !asignaciones.length) {
    throw new Error('compra_id y asignaciones[] con monto > 0 son requeridos.');
  }

  const { data: compra, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id,proyecto_id,supplier_name,supplier_rif,fecha,monto_usd,monto_ves,tasa_bcv_ves_por_usd,moneda_original,notas,invoice_number,tipo_gasto_cco,contrato_obra_id,admin_pct_override,honorarios_usd,capitulo_cco,subcapitulo_cco,forma_pago_cco,cco_estado,tasa_binance,tasa_usada,porcentaje_brecha_real,document_storage_path,document_file_name,entidad_id,imputacion',
    )
    .eq('id', compraId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!compra) throw new Error('Pago no encontrado.');

  const row = compra as Record<string, unknown>;
  if (row.contrato_obra_id != null) {
    throw new Error('El pago ya está vinculado a un contrato; no se puede repartir desde el saco.');
  }
  const tipo = String(row.tipo_gasto_cco ?? '').toUpperCase();
  if (tipo !== 'CONTRATISTA' && tipo !== 'CONTRATO') {
    throw new Error('Solo se pueden repartir pagos tipados como CONTRATISTA.');
  }

  const montoOrigen = round2(num(row.monto_usd));
  const suma = round2(asignaciones.reduce((a, x) => a + x.monto_usd, 0));
  if (suma > montoOrigen + 0.009) {
    throw new Error(
      `La suma de asignaciones ($${suma}) supera el saco ($${montoOrigen}).`,
    );
  }

  const proyectoId = String(row.proyecto_id ?? '');
  if (!proyectoId) throw new Error('El pago no tiene proyecto_id.');

  const contratoIds = Array.from(new Set(asignaciones.map((a) => a.contrato_id)));
  const { data: contratos, error: ctErr } = await supabase
    .from('cco_contratos_obra')
    .select('id,proyecto_id,proveedor,descripcion')
    .in('id', contratoIds);
  if (ctErr) throw ctErr;
  const porId = new Map(
    (contratos ?? []).map((c) => [String((c as { id: string }).id), c as Record<string, unknown>]),
  );
  for (const id of contratoIds) {
    const c = porId.get(id);
    if (!c) throw new Error(`Contrato no encontrado: ${id}`);
    if (String(c.proyecto_id) !== proyectoId) {
      throw new Error('Los contratos deben pertenecer a la misma obra del pago.');
    }
  }

  const creados: string[] = [];
  const now = new Date().toISOString();
  const soloUnoTotal =
    asignaciones.length === 1 && Math.abs(asignaciones[0].monto_usd - montoOrigen) < 0.015;

  if (soloUnoTotal) {
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .update({
        contrato_obra_id: asignaciones[0].contrato_id,
        updated_at: now,
      })
      .eq('id', compraId)
      .is('contrato_obra_id', null)
      .select('id');
    if (error) throw error;
    if (!(data ?? []).length) {
      throw new Error('No se pudo vincular: el pago dejó de ser huérfano.');
    }
    return {
      vinculados: 1,
      creados: [],
      resto_usd: 0,
      compra_id: compraId,
      proyecto_id: proyectoId,
    };
  }

  const batch = Date.now().toString(36).toUpperCase();
  let vinculados = 0;

  for (let i = 0; i < asignaciones.length; i++) {
    const a = asignaciones[i];
    const contrato = porId.get(a.contrato_id)!;
    const invoice = `CCO-SACO-${batch}-${i + 1}`;
    const descBase =
      String(row.notas ?? '').trim() ||
      String(row.invoice_number ?? '').trim() ||
      'Pago saco';
    const notas = `${descBase} · → ${String(contrato.descripcion)} (reparto saco)`.slice(0, 800);

    const insertPayload: Record<string, unknown> = {
      proyecto_id: proyectoId,
      imputacion: row.imputacion ?? 'obra',
      entidad_id: row.entidad_id ?? null,
      invoice_number: invoice,
      supplier_rif: row.supplier_rif,
      supplier_name: row.supplier_name,
      fecha: row.fecha,
      total_amount: 0,
      monto_ves: 0,
      monto_usd: a.monto_usd,
      total_amount_usd: a.monto_usd,
      tasa_bcv_ves_por_usd: num(row.tasa_bcv_ves_por_usd) || 0,
      moneda: String(row.moneda_original ?? 'USD'),
      moneda_original: String(row.moneda_original ?? 'USD'),
      origen: 'cco_reparto_saco',
      estado: 'REGISTRADA',
      notas,
      document_storage_path: row.document_storage_path ?? null,
      document_file_name: row.document_file_name ?? null,
      tipo_gasto_cco: 'CONTRATISTA',
      contrato_obra_id: a.contrato_id,
      admin_pct_override: row.admin_pct_override ?? null,
      honorarios_usd: row.honorarios_usd ?? null,
      capitulo_cco: row.capitulo_cco ?? null,
      subcapitulo_cco: row.subcapitulo_cco ?? null,
      forma_pago_cco: row.forma_pago_cco ?? null,
      cco_estado: row.cco_estado ?? 'PAGADO',
      tasa_binance: row.tasa_binance ?? null,
      tasa_usada: row.tasa_usada ?? null,
      porcentaje_brecha_real: row.porcentaje_brecha_real ?? null,
      monto_pagado_usd: a.monto_usd,
      updated_at: now,
    };

    const { data: nueva, error: iErr } = await supabase
      .from('contabilidad_compras')
      .insert(insertPayload)
      .select('id')
      .single();
    if (iErr) throw iErr;

    const nuevaId = String(nueva.id);
    creados.push(nuevaId);
    vinculados += 1;

    await supabase.from('contabilidad_compra_lineas').insert({
      compra_id: nuevaId,
      descripcion: notas.slice(0, 400),
      cantidad: 1,
      precio_unitario: a.monto_usd,
      subtotal: a.monto_usd,
      unidad: 'UND',
    });
  }

  const resto = round2(montoOrigen - suma);
  if (resto < 0.015) {
    const { error: dErr } = await supabase.from('contabilidad_compras').delete().eq('id', compraId);
    if (dErr) {
      // Si no se puede borrar (FK), dejar monto 0 y anular estado
      await supabase
        .from('contabilidad_compras')
        .update({
          monto_usd: 0,
          total_amount_usd: 0,
          cco_estado: 'ANULADO',
          updated_at: now,
        })
        .eq('id', compraId)
        .is('contrato_obra_id', null);
    }
    return { vinculados, creados, resto_usd: 0, compra_id: null, proyecto_id: proyectoId };
  }

  const { error: uErr } = await supabase
    .from('contabilidad_compras')
    .update({
      monto_usd: resto,
      total_amount_usd: resto,
      monto_pagado_usd: resto,
      updated_at: now,
    })
    .eq('id', compraId)
    .is('contrato_obra_id', null);
  if (uErr) throw uErr;

  return { vinculados, creados, resto_usd: resto, compra_id: compraId, proyecto_id: proyectoId };
}
