import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('*')
      .eq('id', params.id)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No encontrado';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as {
      estado?: string;
      proyecto_id?: string;
      purchase_invoice_id?: string;
    };
    const supabase = await createClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.estado) update.estado = body.estado;
    if (body.proyecto_id !== undefined) update.proyecto_id = body.proyecto_id;
    if (body.purchase_invoice_id !== undefined) update.purchase_invoice_id = body.purchase_invoice_id;

    const { error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .update(update)
      .eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .delete()
      .eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
