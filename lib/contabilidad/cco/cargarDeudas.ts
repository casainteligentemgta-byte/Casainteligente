/**
 * Cuentas por pagar CCO V4 = gastos con estado PENDIENTE / PARCIAL.
 * Complemento: saldos de contratos y pagos huérfanos (resumen).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import {
  honorariosDeFila,
  resolverMontoBaseUsdKpi,
} from '@/lib/contabilidad/cco/kpisOficiales';
import { cargarJerarquiaContratos } from '@/lib/contabilidad/cco/contratosJerarquia';
import type { CcoContratoConSaldo } from '@/lib/contabilidad/cco/types';

export type CcoDeudaGasto = {
  id: string;
  display_id: number | string;
  fecha: string | null;
  proveedor: string;
  descripcion: string;
  tipo: string;
  estado: string;
  forma_pago: string | null;
  monto_base_usd: number;
  honorarios_usd: number;
  costo_total_usd: number;
  monto_pagado_usd: number;
  saldo_usd: number;
};

export type CcoDeudaFila = CcoContratoConSaldo & {
  proveedor: string;
};

export type CcoDeudasResumen = {
  /** Gastos pendientes / parciales (vista principal V4). */
  pendientes: CcoDeudaGasto[];
  totalPendiente: number;
  countPendiente: number;
  /** Contratos con saldo (complemento). */
  deudas: CcoDeudaFila[];
  totalDeuda: number;
  contratosConDeuda: number;
  huerfanosMonto: number;
  huerfanosCount: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function limpiarNotas(notas: string): string {
  const m = notas.match(/^RUBRO:\s*[^|\n]+\|\s*(.+)$/i);
  if (m) return m[1].trim();
  if (/^RUBRO:/i.test(notas)) return '';
  return notas.trim();
}

async function honorariosPct(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<number> {
  const { data: cfg } = await supabase
    .from('cco_proyecto_config')
    .select('honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  if (cfg && (cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct != null) {
    return num((cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct);
  }
  return 15;
}

/** Deudas V4 = gastos PENDIENTE/PARCIAL + resumen de contratos. */
export async function cargarDeudasCco(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoDeudasResumen> {
  const pctGlobal = await honorariosPct(supabase, proyectoId);

  const selectCco =
    'id,fecha,supplier_name,notas,invoice_number,monto_usd,monto_ves,tasa_bcv_ves_por_usd,tasa_binance,moneda_original,tipo_gasto_cco,cco_estado,forma_pago_cco,honorarios_usd,admin_pct_override,monto_pagado_usd,origen_v4_id';
  const selectBase =
    'id,fecha,supplier_name,notas,invoice_number,monto_usd,monto_ves,tasa_bcv_ves_por_usd,tasa_binance,moneda_original';

  type Row = Record<string, unknown>;
  let cols = selectCco;
  let compras: Row[] = [];
  {
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .select(cols)
      .eq('proyecto_id', proyectoId)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .in('cco_estado', ['PENDIENTE', 'PARCIAL'])
      .order('fecha', { ascending: false })
      .limit(2000);
    if (
      error &&
      /cco_estado|tipo_gasto_cco|monto_pagado|honorarios|42703|PGRST204|schema cache/i.test(
        error.message ?? '',
      )
    ) {
      // Sin columnas CCO: no hay forma fiable de marcar pendientes.
      compras = [];
    } else if (error) {
      throw error;
    } else {
      compras = (data ?? []) as unknown as Row[];
    }
    void cols;
  }

  const pendientes: CcoDeudaGasto[] = [];
  for (const r of compras) {
    const notasRaw = String(r.notas ?? '').trim();
    const notas = limpiarNotas(notasRaw);
    const invoice = String(r.invoice_number ?? '').trim() || null;
    const proveedor = String(r.supplier_name ?? '').trim() || 'Sin proveedor';
    const descripcion = (notas && notas.length ? notas : '') || invoice || 'Gasto pendiente';
    if (
      esDescripcionAuditoriaCco(descripcion) ||
      esDescripcionAuditoriaCco(notasRaw) ||
      esCompraSoloAuditoriaCco({
        supplier_name: proveedor,
        notas: notasRaw,
        invoice_number: invoice,
        lineas: notas ? [{ descripcion: notas }] : [],
      })
    ) {
      continue;
    }

    const base = resolverMontoBaseUsdKpi({
      monto_usd: num(r.monto_usd),
      monto_ves: num(r.monto_ves),
      tasa_bcv_ves_por_usd: num(r.tasa_bcv_ves_por_usd),
      tasa_binance: num(r.tasa_binance),
      moneda_original: r.moneda_original != null ? String(r.moneda_original) : null,
    });
    if (base <= 0) continue;

    const honorarios = honorariosDeFila(
      base,
      {
        honorarios_usd: r.honorarios_usd != null ? num(r.honorarios_usd) : null,
        admin_pct_override:
          r.admin_pct_override != null ? num(r.admin_pct_override) : null,
      },
      pctGlobal,
    );
    const costo = base + honorarios;
    const estado = String(r.cco_estado ?? 'PENDIENTE').toUpperCase();
    const pagadoRaw =
      r.monto_pagado_usd != null && r.monto_pagado_usd !== ''
        ? num(r.monto_pagado_usd)
        : null;
    const pagado = pagadoRaw != null && pagadoRaw >= 0 ? pagadoRaw : 0;
    const saldo = Math.max(0, base - pagado);
    if (saldo <= 0.009 && estado === 'PARCIAL') continue;

    const tipoPersistido = String(r.tipo_gasto_cco ?? '').trim();
    const tipo = tipoPersistido || clasificarTipoGasto(proveedor);
    const origenV4 = r.origen_v4_id != null ? num(r.origen_v4_id) : 0;

    pendientes.push({
      id: String(r.id),
      display_id: origenV4 > 0 ? origenV4 : String(r.id).slice(0, 8),
      fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
      proveedor,
      descripcion,
      tipo,
      estado,
      forma_pago: r.forma_pago_cco != null ? String(r.forma_pago_cco) : null,
      monto_base_usd: base,
      honorarios_usd: honorarios,
      costo_total_usd: costo,
      monto_pagado_usd: pagado,
      saldo_usd: estado === 'PENDIENTE' && pagado <= 0 ? base : saldo,
    });
  }

  pendientes.sort((a, b) => {
    const fa = a.fecha ?? '';
    const fb = b.fecha ?? '';
    if (fa !== fb) return fb.localeCompare(fa);
    return b.saldo_usd - a.saldo_usd;
  });

  let deudas: CcoDeudaFila[] = [];
  let huerfanosMonto = 0;
  let huerfanosCount = 0;
  try {
    const jer = await cargarJerarquiaContratos(supabase, proyectoId);
    for (const p of jer.porProveedor) {
      for (const c of p.contratos) {
        if (c.saldo_usd > 0.009) {
          deudas.push({ ...c, proveedor: p.proveedor });
        }
      }
    }
    deudas.sort((a, b) => b.saldo_usd - a.saldo_usd);
    huerfanosMonto = jer.huerfanos.reduce((a, h) => a + h.monto_usd, 0);
    huerfanosCount = jer.huerfanos.length;
  } catch {
    deudas = [];
  }

  return {
    pendientes,
    totalPendiente: pendientes.reduce((a, d) => a + d.saldo_usd, 0),
    countPendiente: pendientes.length,
    deudas,
    totalDeuda: deudas.reduce((a, d) => a + d.saldo_usd, 0),
    contratosConDeuda: deudas.length,
    huerfanosMonto,
    huerfanosCount,
  };
}
