import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado');
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;

    let q = supabase
      .from('ci_facturas_canal_pendientes')
      .select(
        'id, canal, chat_id, chat_label, proyecto_id, estado, purchase_invoice_id, document_file_name, document_storage_path, document_mime_type, extracted, mensaje_error, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (estado) {
      q = q.eq('estado', estado);
    } else {
      const para = searchParams.get('para');
      const estados =
        para === 'lista_compras'
          ? ['extraido', 'pendiente', 'procesando', 'error', 'confirmado']
          : para === 'panel_canal'
            ? [
                'extraido',
                'pendiente',
                'procesando',
                'error',
                'confirmado',
                'rechazado',
              ]
            : ['extraido', 'pendiente', 'procesando', 'error'];
      q = q.in('estado', estados);
    }

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json(
      { pendientes: data ?? [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al listar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
