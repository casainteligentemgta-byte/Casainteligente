import type { SupabaseClient } from '@supabase/supabase-js';
import { montoUsdCompra, montoVesCompra, formatearBs, formatearUsd } from '@/lib/contabilidad/comprasMontos';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/mapCanalPendienteCompra';

export type TotalesComprasObra = {
  facturasContabilidad: number;
  facturasCanalExtra: number;
  totalVes: number;
  totalUsd: number;
};

type CompraRow = {
  id: string;
  total_amount: number;
  monto_ves?: number | null;
  monto_usd?: number | null;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  purchase_invoice_id: string | null;
};

type CanalRow = {
  id: string;
  estado: string;
  purchase_invoice_id: string | null;
  extracted: ExtractedCanalHeader | null;
};

function totalDesdeExtracted(ex: ExtractedCanalHeader | null): number {
  if (!ex) return 0;
  if (ex.total_amount != null && Number.isFinite(Number(ex.total_amount))) {
    return Number(ex.total_amount);
  }
  return (ex.items ?? []).reduce((s, it) => {
    const q = Number(it.quantity) > 0 ? Number(it.quantity) : 0;
    const p = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
    return s + q * p;
  }, 0);
}

/** Suma compras contables + facturas Telegram del proyecto (sin duplicar por purchase_invoice_id). */
export async function calcularTotalesComprasObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<TotalesComprasObra> {
  const pid = proyectoId.trim();
  if (!pid) {
    return { facturasContabilidad: 0, facturasCanalExtra: 0, totalVes: 0, totalUsd: 0 };
  }

  const { data: compras, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id,total_amount,monto_ves,monto_usd,total_amount_usd,tasa_bcv_ves_por_usd,purchase_invoice_id',
    )
    .eq('proyecto_id', pid);

  if (cErr?.code === '42P01') {
    throw new Error('Tabla contabilidad_compras no disponible.');
  }
  if (cErr) throw new Error(cErr.message);

  let totalVes = 0;
  let totalUsd = 0;
  const invoiceIds = new Set<string>();

  for (const row of (compras ?? []) as CompraRow[]) {
    totalVes += montoVesCompra(row);
    totalUsd += montoUsdCompra(row);
    if (row.purchase_invoice_id) invoiceIds.add(String(row.purchase_invoice_id));
  }

  let facturasCanalExtra = 0;
  const { data: canal, error: canalErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id,estado,purchase_invoice_id,extracted')
    .eq('proyecto_id', pid)
    .in('estado', ['extraido', 'pendiente', 'procesando', 'error', 'confirmado']);

  if (!canalErr?.code || canalErr.code !== '42P01') {
    if (canalErr) throw new Error(canalErr.message);
    for (const row of (canal ?? []) as CanalRow[]) {
      if (row.purchase_invoice_id && invoiceIds.has(String(row.purchase_invoice_id))) {
        continue;
      }
      const m = totalDesdeExtracted(row.extracted);
      if (m <= 0) continue;
      totalVes += m;
      facturasCanalExtra += 1;
    }
  }

  return {
    facturasContabilidad: (compras ?? []).length,
    facturasCanalExtra,
    totalVes,
    totalUsd,
  };
}

export function formatearTotalesComprasObra(t: TotalesComprasObra): string {
  const partes: string[] = [];
  if (t.totalVes > 0) partes.push(formatearBs(t.totalVes));
  if (t.totalUsd > 0) partes.push(formatearUsd(t.totalUsd));
  if (!partes.length) return 'Bs. 0,00';
  return partes.join(' · ');
}
