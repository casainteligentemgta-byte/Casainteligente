import { NextResponse } from 'next/server';
import { notificarCuarentenaParaInvoice } from '@/lib/almacen/notificarCuarentenaParaInvoice';
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

    const result = await notificarCuarentenaParaInvoice(admin.client, purchaseInvoiceId);
    if (result.reason === 'factura_no_encontrada') {
      return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al notificar cuarentena';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
