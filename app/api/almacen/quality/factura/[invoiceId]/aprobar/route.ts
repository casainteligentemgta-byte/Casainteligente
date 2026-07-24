import { NextResponse } from 'next/server';
import {
  approveAllQualityInspectionsForInvoice,
  formatApproveError,
} from '@/lib/almacen/approveQualityInspection';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { invoiceId: string } | Promise<{ invoiceId: string }> };

async function resolveInvoiceId(
  params: { invoiceId?: string } | Promise<{ invoiceId?: string }>,
): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const id = p.invoiceId?.trim();
  return id && id !== 'undefined' ? id : null;
}

/** Libera todas las líneas en cuarentena de una factura. */
export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const invoiceId = await resolveInvoiceId(ctx.params);
    if (!invoiceId) {
      return NextResponse.json({ error: 'ID de factura inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await approveAllQualityInspectionsForInvoice(admin.client, invoiceId, null);

    return NextResponse.json({ success: true, ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: formatApproveError(err) }, { status: 400 });
  }
}
