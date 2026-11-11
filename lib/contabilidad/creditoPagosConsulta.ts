import type { SupabaseClient } from '@supabase/supabase-js';
import { todayIsoVenezuela } from '@/lib/contabilidad/comprasFiltros';
import { montoUsdCompra } from '@/lib/contabilidad/comprasMontos';
import {
  redondearUsd,
  resumenPagoCompra,
  type PagoCreditoRow,
} from '@/lib/contabilidad/creditoPagos';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

function tablaAusente(message: string | undefined): boolean {
  return /does not exist|42P01|schema cache/i.test(String(message ?? ''));
}

export async function sumasPagoPorFactura(
  supabase: SupabaseClient,
  purchaseInvoiceIds: string[],
): Promise<Map<string, number>> {
  const ids = purchaseInvoiceIds.map((x) => x.trim()).filter(Boolean);
  const out = new Map<string, number>();
  if (!ids.length) return out;
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data, error } = await supabase
      .from('contabilidad_credito_pagos')
      .select('purchase_invoice_id,monto_usd')
      .in('purchase_invoice_id', chunk);
    if (error) {
      if (tablaAusente(error.message)) return out;
      throw new Error(error.message);
    }
    for (const p of (data ?? []) as PagoCreditoRow[]) {
      const id = String(p.purchase_invoice_id ?? '').trim();
      if (!id) continue;
      out.set(id, redondearUsd((out.get(id) ?? 0) + Number(p.monto_usd ?? 0)));
    }
  }
  return out;
}

/** Completa estado de pago de crédito en el listado de compras (cliente o servidor). */
export async function enriquecerComprasConPagoCredito<T extends CompraListaUnificada>(
  supabase: SupabaseClient,
  compras: T[],
  hoyIso = todayIsoVenezuela(),
): Promise<T[]> {
  const ids = compras
    .map((c) => String(c.purchase_invoice_id ?? '').trim())
    .filter(Boolean);
  let sumas = new Map<string, number>();
  try {
    sumas = await sumasPagoPorFactura(supabase, ids);
  } catch {
    return compras;
  }
  return compras.map((c) => {
    const pid = String(c.purchase_invoice_id ?? '').trim();
    const pagado = pid ? (sumas.get(pid) ?? 0) : 0;
    const r = resumenPagoCompra({
      condicionPago: c.condicion_pago,
      fechaVencimiento: c.fecha_vencimiento,
      pagadoUsd: pagado,
      totalUsd: montoUsdCompra(c),
      hoyIso,
    });
    return {
      ...c,
      pago_credito_estado: r.estado,
      pago_credito_saldo_usd: r.saldoUsd,
      pago_credito_pagado_usd: pagado,
    };
  });
}

export { tablaAusente };
