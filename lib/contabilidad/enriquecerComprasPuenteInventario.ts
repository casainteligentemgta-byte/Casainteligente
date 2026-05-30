import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

/** Completa puente inventario desde compras_facturas si contabilidad aún no tiene los campos. */
export async function enriquecerComprasPuenteInventario(
  supabase: SupabaseClient,
  compras: CompraListaUnificada[],
): Promise<CompraListaUnificada[]> {
  const candidatas = compras.filter(
    (c) =>
      (c.fuente_lista === 'app' || c.fuente_lista == null) &&
      c.purchase_invoice_id?.trim() &&
      (!c.compra_factura_id || !c.ingresado_almacen_at),
  );

  if (!candidatas.length) return compras;

  const invoiceIds = Array.from(
    new Set(candidatas.map((c) => c.purchase_invoice_id!.trim())),
  ).slice(0, 400);

  const { data, error } = await supabase
    .from('compras_facturas')
    .select('id, purchase_invoice_id, numero_factura, estado, registrada_at, updated_at')
    .in('purchase_invoice_id', invoiceIds);

  if (error?.code === '42P01' || error) return compras;

  const porInvoice = new Map<
    string,
    {
      id: string;
      numero_factura: string | null;
      estado: string | null;
      registrada_at: string | null;
      updated_at: string | null;
    }
  >();

  for (const row of data ?? []) {
    const invId = String(
      (row as { purchase_invoice_id: string | null }).purchase_invoice_id ?? '',
    ).trim();
    if (invId) porInvoice.set(invId, row as typeof porInvoice extends Map<string, infer V> ? V : never);
  }

  if (!porInvoice.size) return compras;

  return compras.map((c) => {
    const invId = c.purchase_invoice_id?.trim();
    if (!invId) return c;
    const cf = porInvoice.get(invId);
    if (!cf) return c;

    const ingresado =
      c.ingresado_almacen_at ??
      cf.registrada_at ??
      cf.updated_at ??
      null;

    return {
      ...c,
      compra_factura_id: c.compra_factura_id ?? cf.id,
      ingresado_almacen_at: ingresado,
      compra_factura: c.compra_factura ?? {
        numero_factura: cf.numero_factura,
        estado: cf.estado,
      },
    };
  });
}
