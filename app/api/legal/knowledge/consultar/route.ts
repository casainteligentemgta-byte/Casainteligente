import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { consultarAbogadoSenior } from '@/lib/legal/consultarAbogadoSenior';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/legal/knowledge/consultar
 * Body: { query, categoria?, match_threshold?, match_count? }
 * Recupera contexto RAG y responde como Abogado Senior (Derecho Venezolano).
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

  const query = String(body.query ?? body.consulta ?? body.q ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'query requerido' }, { status: 400 });
  }

  const categoria =
    body.categoria != null ? String(body.categoria).trim() || null : null;

  const matchThreshold =
    typeof body.match_threshold === 'number'
      ? body.match_threshold
      : typeof body.matchThreshold === 'number'
        ? body.matchThreshold
        : 0.65;

  const matchCount =
    typeof body.match_count === 'number'
      ? body.match_count
      : typeof body.matchCount === 'number'
        ? body.matchCount
        : 6;

  try {
    const result = await consultarAbogadoSenior(gate.admin, query, {
      categoria,
      matchThreshold,
      matchCount,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint: string | undefined;
    if (msg.includes('match_legal_knowledge') || msg.includes('ci_legal_knowledge')) {
      hint =
        'Ejecute las migraciones 268 y 269 en Supabase e ingeste documentos legales.';
    } else if (msg.includes('GEMINI_API_KEY')) {
      hint = 'Configure GEMINI_API_KEY en Vercel (chat legal / IurisVigía).';
    } else if (msg.includes('OPENAI_API_KEY') || msg.includes('gpt-4o') || msg.includes('OpenAI')) {
      hint =
        'La búsqueda RAG usa embeddings OpenAI (OPENAI_API_KEY). El chat ya usa Gemini si hay GEMINI_API_KEY.';
    }
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }
}
