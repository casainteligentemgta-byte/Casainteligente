import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchPhemeEmbeddings } from '@/lib/pheme/searchPhemeEmbeddings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST JSON — búsqueda semántica sobre transcripciones Pheme.
 * { query: string, reunionId?: string, matchThreshold?: number, matchCount?: number }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  let body: {
    query?: string;
    reunionId?: string;
    matchThreshold?: number;
    matchCount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const query = String(body.query ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'query requerido' }, { status: 400 });
  }

  try {
    const hits = await searchPhemeEmbeddings(supabase, query, {
      reunionId: body.reunionId?.trim() || null,
      matchThreshold: typeof body.matchThreshold === 'number' ? body.matchThreshold : 0.65,
      matchCount: typeof body.matchCount === 'number' ? body.matchCount : 8,
    });
    return NextResponse.json({ data: hits });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = msg.includes('match_pheme_embeddings')
      ? ' Ejecute la migración 299_ci_pheme_pipeline_embeddings.sql.'
      : '';
    return NextResponse.json({ error: `${msg}${hint}` }, { status: 500 });
  }
}
