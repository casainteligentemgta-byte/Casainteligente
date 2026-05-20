import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado');
    const supabase = await createClient();

    let q = supabase
      .from('ci_facturas_canal_pendientes')
      .select(
        'id, canal, chat_id, chat_label, proyecto_id, estado, document_file_name, extracted, mensaje_error, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (estado) {
      q = q.eq('estado', estado);
    } else {
      q = q.in('estado', ['extraido', 'pendiente', 'procesando', 'error']);
    }

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ pendientes: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al listar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
