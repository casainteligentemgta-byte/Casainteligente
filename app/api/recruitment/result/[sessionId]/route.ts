import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loadSession, normalizeSessionId } from '@/lib/recruitment/session-store';
import { buildCeoPayload } from '@/lib/recruitment/scoring';
import { recruitmentCeoCookieName, verifyRecruitmentCeoAuthorized } from '@/lib/recruitment/ceo-auth';
import { hasSupabaseCeoSession } from '@/lib/recruitment/ceo-auth-server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(recruitmentCeoCookieName())?.value;
    const hasSupabaseUser = await hasSupabaseCeoSession();
    if (
      !verifyRecruitmentCeoAuthorized({
        req,
        cookieVal,
        hasSupabaseUser,
      })
    ) {
      return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    }

    const sessionId = normalizeSessionId(params.sessionId);
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
    }
    const state = await loadSession(sessionId);
    if (!state) {
      return NextResponse.json({ error: 'no encontrada' }, { status: 404 });
    }
    try {
      const analyses = Array.isArray(state.analyses) ? state.analyses : [];
      const payload = buildCeoPayload(state, analyses);
      return NextResponse.json(payload);
    } catch (e) {
      console.error('[recruitment/result]', sessionId, e);
      const msg = e instanceof Error ? e.message : 'Error al armar el resumen';
      return NextResponse.json(
        {
          error: 'payload_invalido',
          message: msg,
          hint: 'La fila de sesión en base de datos puede estar corrupta.',
        },
        { status: 422 },
      );
    }
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'digest' in e &&
      (e as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE'
    ) {
      throw e;
    }
    console.error('[recruitment/result] fatal', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'fatal', message: msg }, { status: 503 });
  }
}
