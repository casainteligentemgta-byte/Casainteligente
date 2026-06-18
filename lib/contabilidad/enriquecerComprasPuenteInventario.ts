import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

type CompraFacturaPuente = {
  id: string;
  numero_factura: string | null;
  estado: string | null;
  registrada_at: string | null;
  updated_at: string | null;
  ubicacion_destino_id: string | null;
};

/** Completa puente inventario desde compras_facturas / purchase_invoices si contabilidad aún no tiene los campos. */
export async function enriquecerComprasPuenteInventario(
  supabase: SupabaseClient,
  compras: CompraListaUnificada[],
): Promise<CompraListaUnificada[]> {
  const candidatas = compras.filter(
    (c) =>
      (c.fuente_lista === 'app' || c.fuente_lista == null) &&
      c.purchase_invoice_id?.trim() &&
      (!c.compra_factura_id ||
        !c.ingresado_almacen_at ||
        !c.ubicacion_destino_id?.trim()),
  );

  if (!candidatas.length) return compras;

  const invoiceIds = Array.from(
    new Set(candidatas.map((c) => c.purchase_invoice_id!.trim())),
  ).slice(0, 400);

  const { data, error } = await supabase
    .from('compras_facturas')
    .select(
      'id, purchase_invoice_id, numero_factura, estado, registrada_at, updated_at, ubicacion_destino_id',
    )
    .in('purchase_invoice_id', invoiceIds);

  if (error?.code === '42P01' || error) return compras;

  const porInvoice = new Map<string, CompraFacturaPuente>();

  for (const row of data ?? []) {
    const invId = String(
      (row as { purchase_invoice_id: string | null }).purchase_invoice_id ?? '',
    ).trim();
    if (invId) porInvoice.set(invId, row as CompraFacturaPuente);
  }

  const porInvoicePi = new Map<string, string>();
  const idsSinUbicacion = invoiceIds.filter((invId) => {
    const cf = porInvoice.get(invId);
    return !cf?.ubicacion_destino_id?.trim();
  });

  if (idsSinUbicacion.length) {
    const { data: piRows } = await supabase
      .from('purchase_invoices')
      .select('id, ubicacion_destino_id')
      .in('id', idsSinUbicacion.slice(0, 400));

    for (const row of piRows ?? []) {
      const id = String((row as { id: string }).id ?? '').trim();
      const ubi = String(
        (row as { ubicacion_destino_id?: string | null }).ubicacion_destino_id ?? '',
      ).trim();
      if (id && ubi) porInvoicePi.set(id, ubi);
    }
  }

  if (!porInvoice.size && !porInvoicePi.size) return compras;

  return compras.map((c) => {
    const invId = c.purchase_invoice_id?.trim();
    if (!invId) return c;
    const cf = porInvoice.get(invId);
    const ubiCf = cf?.ubicacion_destino_id?.trim() || '';
    const ubiPi = porInvoicePi.get(invId) || '';
    const ubicacionDestinoId =
      c.ubicacion_destino_id?.trim() || ubiCf || ubiPi || null;

    if (!cf && !ubicacionDestinoId) return c;

    const ingresado =
      c.ingresado_almacen_at ?? cf?.registrada_at ?? cf?.updated_at ?? null;

    return {
      ...c,
      ubicacion_destino_id: ubicacionDestinoId,
      compra_factura_id: c.compra_factura_id ?? cf?.id ?? c.compra_factura_id,
      ingresado_almacen_at: ingresado,
      compra_factura:
        c.compra_factura ??
        (cf
          ? {
              numero_factura: cf.numero_factura,
              estado: cf.estado,
            }
          : c.compra_factura),
    };
  });
}
