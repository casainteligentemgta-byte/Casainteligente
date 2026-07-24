import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { searchLegalKnowledge } from '@/lib/legal/searchLegalKnowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/legal/knowledge/search
 * Body: { query, categoria?, match_threshold?, match_count?, filter_metadata? }
 */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const query = String(body.query ?? body.q ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'query requerido' }, { status: 400 });
  }

  const categoria =
    body.categoria != null
      ? String(body.categoria).trim() || null
      : body.category_filter != null
        ? String(body.category_filter).trim() || null
        : null;

  const matchThreshold =
    typeof body.match_threshold === 'number'
      ? body.match_threshold
      : typeof body.matchThreshold === 'number'
        ? body.matchThreshold
        : 0.7;

  const matchCount =
    typeof body.match_count === 'number'
      ? body.match_count
      : typeof body.matchCount === 'number'
        ? body.matchCount
        : 5;

  const filterMetadata =
    body.filter_metadata && typeof body.filter_metadata === 'object'
      ? (body.filter_metadata as Record<string, unknown>)
      : body.filterMetadata && typeof body.filterMetadata === 'object'
        ? (body.filterMetadata as Record<string, unknown>)
        : null;

  try {
    const hits = await searchLegalKnowledge(gate.admin, query, {
      categoryFilter: categoria,
      matchThreshold,
      matchCount,
      filterMetadata,
    });
    return NextResponse.json({ ok: true, results: hits, count: hits.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = msg.includes('match_legal_knowledge')
      ? 'Ejecute la migración 269_match_legal_knowledge.sql en Supabase SQL Editor.'
      : msg.includes('OPENAI_API_KEY')
        ? 'Configure OPENAI_API_KEY en Vercel / entorno.'
        : undefined;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }
}
