import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  procesarTurnoAsesorCaso,
  type AsesorTurnMessage,
} from '@/lib/legal/asesorCasoDinamico';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/legal/knowledge/asesor-caso
 * Entrevista multi-turno + dictamen RAG con vista de contraparte.
 *
 * Body: {
 *   messages: [{ role: 'user'|'assistant', content: string }],
 *   categoria?, submodulo?, hechos_consolidados?, forzar_dictamen?
 * }
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

  const rawMessages = Array.isArray(body.messages) ? body.messages : null;
  if (!rawMessages?.length) {
    return NextResponse.json(
      { error: 'messages requerido (historial con el último mensaje del usuario)' },
      { status: 400 },
    );
  }

  const messages: AsesorTurnMessage[] = rawMessages
    .map((m) => {
      const row = m as Record<string, unknown>;
      const role = row.role === 'assistant' ? 'assistant' : 'user';
      return { role, content: String(row.content ?? '').trim() };
    })
    .filter((m) => m.content);

  if (!messages.length) {
    return NextResponse.json({ error: 'messages vacío' }, { status: 400 });
  }

  const categoria =
    body.categoria != null ? String(body.categoria).trim() || null : null;
  const submodulo =
    body.submodulo != null ? String(body.submodulo).trim() || null : null;
  const hechos =
    body.hechos_consolidados != null
      ? String(body.hechos_consolidados)
      : body.hechosConsolidados != null
        ? String(body.hechosConsolidados)
        : null;
  const forzar =
    body.forzar_dictamen === true ||
    body.forzarDictamen === true ||
    body.force === true;

  try {
    const result = await procesarTurnoAsesorCaso(gate.admin, {
      messages,
      categoria,
      submodulo,
      hechos_consolidados: hechos,
      forzar_dictamen: forzar,
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
    } else if (msg.includes('OPENAI_API_KEY') || msg.includes('OpenAI')) {
      hint =
        'La búsqueda RAG usa embeddings OpenAI (OPENAI_API_KEY). El chat usa Gemini si hay GEMINI_API_KEY.';
    }
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }
}
