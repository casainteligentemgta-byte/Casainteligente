import type { SupabaseClient } from '@supabase/supabase-js';
import { updateContabilidadCompraRow } from '@/lib/contabilidad/updateContabilidadCompraRow';
import {
  sincronizarContabilidadTrasInventarioRpc,
  vincularProcuraCompraContabilidad,
} from '@/lib/procuras/vincularProcuraCompra';

type ResumenInspeccion = { status: string };

/**
 * Marca compra contable con vínculo a compras_facturas y timestamp de primer ingreso.
 */
export async function sincronizarContabilidadTrasInventarioCompra(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  opts?: { procuraId?: string | null },
): Promise<{ compraFacturaId: string | null }> {
  const invId = purchaseInvoiceId.trim();
  if (!invId) return { compraFacturaId: null };

  const rpc = await sincronizarContabilidadTrasInventarioRpc(supabase, invId);
  if (rpc.rpcOk) {
    await vincularProcuraCompraContabilidad(supabase, {
      purchaseInvoiceId: invId,
      procuraId: opts?.procuraId ?? null,
    }).catch(() => undefined);
    return { compraFacturaId: rpc.compraFacturaId };
  }

  const { data: cf, error: cfErr } = await supabase
    .from('compras_facturas')
    .select('id, registrada_at, updated_at')
    .eq('purchase_invoice_id', invId)
    .maybeSingle();

  if (cfErr || !cf?.id) return { compraFacturaId: null };

  const compraFacturaId = String(cf.id);
  const ingresadoAt =
    (cf as { registrada_at?: string | null }).registrada_at ??
    (cf as { updated_at?: string | null }).updated_at ??
    new Date().toISOString();

  let compraRes = await supabase
    .from('contabilidad_compras')
    .select('id, ingresado_almacen_at, cuarentena_rechazo_total')
    .eq('purchase_invoice_id', invId)
    .maybeSingle();

  if (
    compraRes.error &&
    /cuarentena_rechazo_total|ingresado_almacen_at|42703|schema cache/i.test(
      compraRes.error.message ?? '',
    )
  ) {
    compraRes = await supabase
      .from('contabilidad_compras')
      .select('id')
      .eq('purchase_invoice_id', invId)
      .maybeSingle();
  }

  const compra = compraRes.data as
    | { id: string; ingresado_almacen_at?: string | null; cuarentena_rechazo_total?: boolean }
    | null;

  if (!compra?.id) return { compraFacturaId };

  const patch: Record<string, unknown> = {
    compra_factura_id: compraFacturaId,
    cuarentena_rechazo_total: false,
  };
  if (!compra.ingresado_almacen_at) {
    patch.ingresado_almacen_at = ingresadoAt;
  }

  const { error: upErr } = await updateContabilidadCompraRow(supabase, compra.id, patch);
  if (upErr && /cuarentena_rechazo_total|42703|schema cache/i.test(upErr.message ?? '')) {
    const slim: Record<string, unknown> = { compra_factura_id: compraFacturaId };
    if (!compra.ingresado_almacen_at) slim.ingresado_almacen_at = ingresadoAt;
    await updateContabilidadCompraRow(supabase, compra.id, slim);
  }

  await vincularProcuraCompraContabilidad(supabase, {
    purchaseInvoiceId: invId,
    contabilidadCompraId: compra.id,
    procuraId: opts?.procuraId ?? null,
  }).catch(() => undefined);

  return { compraFacturaId };
}

/** Cierra purchase_invoices cuando no quedan inspecciones PENDIENTE. */
export async function intentarCompletarPurchaseInvoice(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<boolean> {
  const invId = purchaseInvoiceId.trim();
  if (!invId) return false;

  const { count, error } = await supabase
    .from('quality_inspections')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invId)
    .eq('status', 'PENDIENTE');

  if (error || (count ?? 0) > 0) return false;

  const { error: upErr } = await supabase
    .from('purchase_invoices')
    .update({ status: 'COMPLETADO' })
    .eq('id', invId);

  return !upErr;
}

/**
 * Si todas las inspecciones están RECHAZADO y no hay compras_facturas, marca rechazo total en contabilidad.
 */
export async function revisarCuarentenaRechazoTotal(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<void> {
  const invId = purchaseInvoiceId.trim();
  if (!invId) return;

  const { data: cf } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('purchase_invoice_id', invId)
    .maybeSingle();

  if (cf?.id) return;

  const { data: inspecciones, error: inspErr } = await supabase
    .from('quality_inspections')
    .select('status')
    .eq('invoice_id', invId);

  if (inspErr || !inspecciones?.length) return;

  const rows = inspecciones as ResumenInspeccion[];
  const hayPendiente = rows.some((r) => r.status === 'PENDIENTE');
  const hayAprobado = rows.some((r) => r.status === 'APROBADO');
  if (hayPendiente || hayAprobado) return;

  const todoRechazado = rows.every((r) => r.status === 'RECHAZADO');
  if (!todoRechazado) return;

  const { error: rechazoErr } = await supabase
    .from('contabilidad_compras')
    .update({ cuarentena_rechazo_total: true } as never)
    .eq('purchase_invoice_id', invId);

  if (rechazoErr && /cuarentena_rechazo_total|42703|schema cache/i.test(rechazoErr.message ?? '')) {
    /* migración 202 pendiente */
  }
}
