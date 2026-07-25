import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMeeting } from '@/lib/pheme/processMeeting';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST — ejecuta STT (Whisper) + agente Pheme + embeddings.
 * Body JSON opcional: { preferredSttProvider?: 'openai'|'groq'|'auto', skipEmbeddings?: boolean }
 */
export async function POST(req: Request, context: RouteContext) {
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

  const { data: reunion, error: fetchError } = await supabase
    .from('reuniones')
    .select('id, user_id, estado')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!reunion) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  let preferredSttProvider: 'openai' | 'groq' | 'auto' = 'auto';
  let skipEmbeddings = false;
  try {
    const body = (await req.json()) as {
      preferredSttProvider?: string;
      skipEmbeddings?: boolean;
    };
    const p = String(body.preferredSttProvider ?? 'auto').toLowerCase();
    if (p === 'openai' || p === 'groq' || p === 'auto') preferredSttProvider = p;
    skipEmbeddings = Boolean(body.skipEmbeddings);
  } catch {
    // body opcional
  }

  try {
    const result = await processMeeting(supabase, id, {
      preferredSttProvider,
      skipEmbeddings,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint =
      msg.includes('OPENAI_API_KEY') || msg.includes('GROQ_API_KEY')
        ? ' Configure las claves de API en el entorno.'
        : msg.includes('migración') || msg.includes('reuniones')
          ? ' Ejecute la migración 288_ci_pheme_reuniones.sql.'
          : '';
    return NextResponse.json({ error: `${msg}${hint}` }, { status: 500 });
  }
}
