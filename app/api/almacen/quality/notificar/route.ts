import { NextResponse } from 'next/server';
import { notificarNuevaCuarentenaTelegram } from '@/lib/almacen/notificarCuarentenaTelegram';
import {
  chatIdsDesdeDestinatarios,
  resolverDestinatariosCuarentenaTelegram,
} from '@/lib/almacen/resolverDestinatariosCuarentenaTelegram';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type Body = { purchaseInvoiceId?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const purchaseInvoiceId = String(body.purchaseInvoiceId ?? '').trim();
    if (!purchaseInvoiceId) {
      return NextResponse.json({ error: 'purchaseInvoiceId requerido.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { data: invoiceRaw } = await admin.client
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
      return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 });
    }

    const proyectoId = invoice.proyecto_id?.trim() || null;
    const ubicacionDestinoId = invoice.ubicacion_destino_id?.trim() || null;

    let proyectoNombre: string | null = null;
    if (proyectoId) {
      const { data: proyRaw } = await admin.client
        .from('ci_proyectos')
        .select('nombre')
        .eq('id', proyectoId)
        .maybeSingle();
      const proy = proyRaw as { nombre?: string | null } | null;
      proyectoNombre = proy?.nombre ? String(proy.nombre).trim() : null;
    }

    let ubicacionNombre: string | null = null;
    if (ubicacionDestinoId) {
      const { data: ubRaw } = await admin.client
        .from('inv_ubicaciones')
        .select('nombre, tipo')
        .eq('id', ubicacionDestinoId)
        .maybeSingle();
      const ub = ubRaw as { nombre?: string | null; tipo?: string | null } | null;
      if (ub?.nombre) {
        ubicacionNombre = `${String(ub.nombre).trim()}${ub.tipo ? ` (${ub.tipo})` : ''}`;
      }
    }

    const { count } = await admin.client
      .from('quality_inspections')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', purchaseInvoiceId)
      .eq('status', 'PENDIENTE');

    const lineCount = count ?? 0;
    if (lineCount === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'sin_pendientes' });
    }

    const enrutamiento = await resolverDestinatariosCuarentenaTelegram(admin.client, {
      proyectoId,
      ubicacionDestinoId,
    });

    const chatIds = chatIdsDesdeDestinatarios(enrutamiento.destinatarios);
    if (!chatIds.length) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: 'sin_destinatarios',
        proyectoId: enrutamiento.proyectoId,
      });
    }

    const result = await notificarNuevaCuarentenaTelegram({
      invoiceNumber: String(invoice.invoice_number ?? 'S/N').trim() || 'S/N',
      supplierName: String(invoice.supplier_name ?? 'Proveedor').trim() || 'Proveedor',
      lineCount,
      proyectoNombre: proyectoNombre ?? enrutamiento.proyectoNombre,
      ubicacionNombre,
      chatIds,
    });

    return NextResponse.json({
      ...result,
      enrutamiento: enrutamiento.destinatarios,
      proyectoId: enrutamiento.proyectoId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al notificar cuarentena';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
