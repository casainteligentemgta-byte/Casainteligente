import type { SupabaseClient } from '@supabase/supabase-js';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { monedaOriginalCompra } from '@/lib/contabilidad/monedaCompra';

type CompraRow = {
  id: string;
  fecha: string;
  total_amount: number;
  moneda: string | null;
  moneda_original: string | null;
  tasa_bcv_ves_por_usd: number | null;
};

/** Suma subtotales de líneas y actualiza montos bimonetarios de la compra. */
export async function recalcularTotalesCompraContable(
  supabase: SupabaseClient,
  compra: CompraRow,
  opts?: { forzarTasaBcvPorFecha?: boolean },
): Promise<void> {
  const { data: lineas, error: lnErr } = await supabase
    .from('contabilidad_compra_lineas')
    .select('subtotal')
    .eq('compra_id', compra.id);
  if (lnErr) throw lnErr;

  const sumSubtotal = (lineas ?? []).reduce((acc, l) => acc + Number(l.subtotal ?? 0), 0);
  const montos = await resolverMontosCompraBimonetario({
    montoTotal: sumSubtotal,
    moneda: monedaOriginalCompra(compra),
    fecha: compra.fecha,
    tasaBcvDigitada: opts?.forzarTasaBcvPorFecha ? null : compra.tasa_bcv_ves_por_usd,
  });

  const { error: upErr } = await supabase
    .from('contabilidad_compras')
    .update(payloadCompraBimonetario(montos) as never)
    .eq('id', compra.id);
  if (upErr) throw upErr;
}
