import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CcoContratoConSaldo,
  CcoContratoObra,
  CcoPagoVinculado,
  CcoProveedorContratos,
} from '@/lib/contabilidad/cco/types';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  };
}

export function enriquecerContratoConPagos(
  contrato: CcoContratoObra,
  pagos: CcoPagoVinculado[],
): CcoContratoConSaldo {
  const monto_pagado_usd = pagos.reduce((a, p) => a + p.monto_usd, 0);
  const saldo_usd = Math.max(0, contrato.costo_total_usd - monto_pagado_usd);
  const pct_avance =
    contrato.costo_total_usd > 0
      ? Math.min(100, Math.round((monto_pagado_usd / contrato.costo_total_usd) * 1000) / 10)
      : 0;
  return { ...contrato, monto_pagado_usd, saldo_usd, pct_avance, pagos };
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
  },
): Promise<CcoContratoObra> {
  const pctGlobal = input.pct_global ?? 15;
  const calc = aplicarHonorariosABase(input.monto_base_usd, input.admin_pct, pctGlobal);
  const payload = {
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

  const { data, error } = await supabase
    .from('cco_contratos_obra')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapContrato(data as Record<string, unknown>);
}

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
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}
