import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ci_lulo_import_snapshots')
      .select('*')
      .eq('id', params.id)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Snapshot no encontrado';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { payload?: unknown; resumen?: unknown };
    const supabase = await createClient();
    const update: Record<string, unknown> = {};
    if (body.payload !== undefined) update.payload = body.payload;
    if (body.resumen !== undefined) update.resumen = body.resumen;

    const { data, error } = await supabase
      .from('ci_lulo_import_snapshots')
      .update(update)
      .eq('id', params.id)
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar snapshot';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('ci_lulo_import_snapshots').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al borrar snapshot';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
