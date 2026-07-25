import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/** GET — detalle de reunión + análisis Pheme. */
export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  const { data: reunion, error } = await supabase
    .from('reuniones')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!reunion) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  const { data: analisis } = await supabase
    .from('pheme_analisis')
    .select('*')
    .eq('reunion_id', id)
    .maybeSingle();

  const { count: embeddingsCount } = await supabase
    .from('pheme_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('reunion_id', id);

  return NextResponse.json({
    data: {
      reunion,
      analisis: analisis ?? null,
      embeddings_count: embeddingsCount ?? 0,
    },
  });
}
