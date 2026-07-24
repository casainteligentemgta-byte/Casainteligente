import type { SupabaseClient } from '@supabase/supabase-js';
import {
  notificarNuevaCuarentenaTelegram,
  type NotificarCuarentenaResult,
} from '@/lib/almacen/notificarCuarentenaTelegram';
import {
  chatIdsDesdeDestinatarios,
  resolverDestinatariosCuarentenaTelegram,
} from '@/lib/almacen/resolverDestinatariosCuarentenaTelegram';

export async function notificarCuarentenaParaInvoice(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<NotificarCuarentenaResult & { reason?: string }> {
  const { data: invoiceRaw } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_number, supplier_name, proyecto_id, ubicacion_destino_id')
    .eq('id', purchaseInvoiceId)
    .maybeSingle();

  const invoice = invoiceRaw as {
    invoice_number?: string | null;
    supplier_name?: string | null;
    proyecto_id?: string | null;
    ubicacion_destino_id?: string | null;
  } | null;

  if (!invoice) {
    return { ok: false, skipped: true, reason: 'factura_no_encontrada' };
  }

  const proyectoId = invoice.proyecto_id?.trim() || null;
  const ubicacionDestinoId = invoice.ubicacion_destino_id?.trim() || null;

  let proyectoNombre: string | null = null;
  if (proyectoId) {
    const { data: proyRaw } = await supabase
      .from('ci_proyectos')
      .select('nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    proyectoNombre = proyRaw?.nombre ? String(proyRaw.nombre).trim() : null;
  }

  let ubicacionNombre: string | null = null;
  if (ubicacionDestinoId) {
    const { data: ubRaw } = await supabase
      .from('inv_ubicaciones')
      .select('nombre, tipo')
      .eq('id', ubicacionDestinoId)
      .maybeSingle();
    const ub = ubRaw as { nombre?: string | null; tipo?: string | null } | null;
    if (ub?.nombre) {
      ubicacionNombre = `${String(ub.nombre).trim()}${ub.tipo ? ` (${ub.tipo})` : ''}`;
    }
  }

  const { count } = await supabase
    .from('quality_inspections')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', purchaseInvoiceId)
    .eq('status', 'PENDIENTE');

  const lineCount = count ?? 0;
  if (lineCount === 0) {
    return { ok: true, skipped: true, reason: 'sin_pendientes' };
  }

  const enrutamiento = await resolverDestinatariosCuarentenaTelegram(supabase, {
    proyectoId,
    ubicacionDestinoId,
  });

  const chatIds = chatIdsDesdeDestinatarios(enrutamiento.destinatarios);
  if (!chatIds.length) {
    return { ok: false, skipped: true, reason: 'sin_destinatarios' };
  }

  return notificarNuevaCuarentenaTelegram({
    invoiceNumber: String(invoice.invoice_number ?? 'S/N').trim() || 'S/N',
    supplierName: String(invoice.supplier_name ?? 'Proveedor').trim() || 'Proveedor',
    lineCount,
    proyectoNombre: proyectoNombre ?? enrutamiento.proyectoNombre,
    ubicacionNombre,
    chatIds,
  });
}
