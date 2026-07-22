import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { FechaCompraAnomalaError } from '@/lib/contabilidad/auditoriaFechaCompra';
import {
  aplicarCertificacionFacturaAdjunta,
  type CompraParaCertificar,
  type DecisionCertificarFactura,
} from '@/lib/contabilidad/certificarFacturaAdjunta';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

type RouteCtx = { params: Promise<{ id: string }> };

type Body = {
  decision?: DecisionCertificarFactura;
  extracted?: ExtractedPurchaseInvoice;
  confirmar_fecha_anomala?: boolean;
  /** Nº fiscal manual si el OCR no lo extrajo. */
  invoice_number?: string | null;
  /** RIF manual si el OCR no lo extrajo. */
  supplier_rif?: string | null;
};

/**
 * Aplica la decisión del popup de disparidad tras adjuntar factura:
 * - mantener_cco: conserva cabecera/monto del CSV e importa ítems OCR
 * - usar_factura: actualiza cabecera/monto con la factura e importa ítems
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'ID de compra requerido.' }, { status: 400 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    const decision = body.decision;
    if (decision !== 'mantener_cco' && decision !== 'usar_factura') {
      return NextResponse.json(
        { error: 'Indique decision: mantener_cco o usar_factura.' },
        { status: 400 },
      );
    }

    const extracted = body.extracted;
    if (!extracted || typeof extracted !== 'object') {
      return NextResponse.json({ error: 'Falta extracted (OCR de la factura).' }, { status: 400 });
    }

    const supabase = await createClient();
    const compraId = id.trim();
    const { data: compra, error: compraErr } = await supabase
      .from('contabilidad_compras')
      .select(
        'id, fecha, supplier_name, supplier_rif, invoice_number, origen, total_amount, total_amount_usd, tasa_bcv_ves_por_usd, moneda, moneda_original, monto_ves, monto_usd',
      )
      .eq('id', compraId)
      .maybeSingle();

    if (compraErr) throw compraErr;
    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada.' }, { status: 404 });
    }

    const admin = supabaseAdminForRoute();
    const db = admin.ok ? admin.client : supabase;

    const compraCert: CompraParaCertificar = {
      id: compra.id,
      fecha: compra.fecha,
      supplier_name: compra.supplier_name,
      supplier_rif: compra.supplier_rif,
      invoice_number: compra.invoice_number,
      origen: compra.origen,
      total_amount: Number(compra.total_amount) || 0,
      total_amount_usd: compra.total_amount_usd,
      tasa_bcv_ves_por_usd: compra.tasa_bcv_ves_por_usd,
      moneda: compra.moneda,
      moneda_original: compra.moneda_original,
      monto_ves: compra.monto_ves,
      monto_usd: compra.monto_usd,
    };

    const result = await aplicarCertificacionFacturaAdjunta(db, {
      compra: compraCert,
      extracted,
      decision,
      confirmarFechaAnomala: Boolean(body.confirmar_fecha_anomala),
      invoiceNumberManual: body.invoice_number,
      supplierRifManual: body.supplier_rif,
    });

    const { data: updated } = await db
      .from('contabilidad_compras')
      .select(
        'id,fecha,invoice_number,supplier_name,supplier_rif,total_amount,total_amount_usd,moneda,moneda_original,monto_ves,monto_usd,tasa_bcv_ves_por_usd',
      )
      .eq('id', compraId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      ...result,
      compra: updated,
    });
  } catch (e) {
    if (e instanceof FechaCompraAnomalaError) {
      return NextResponse.json(
        {
          error: e.message,
          codigo: 'fecha_anomala',
          audit: e.audit,
          requiere_confirmacion: true,
        },
        { status: 422 },
      );
    }
    const message = e instanceof Error ? e.message : 'No se pudo certificar la factura.';
    console.error('[POST compra document certificar]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
