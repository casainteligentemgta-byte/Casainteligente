import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loadSession, normalizeSessionId } from '@/lib/recruitment/session-store';
import { buildCeoPayload } from '@/lib/recruitment/scoring';
import { recruitmentCeoCookieName, verifyRecruitmentCeoAuthorized } from '@/lib/recruitment/ceo-auth';
import { hasSupabaseCeoSession } from '@/lib/recruitment/ceo-auth-server';

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const cookieVal = cookies().get(recruitmentCeoCookieName())?.value;
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
  const payload = buildCeoPayload(state, state.analyses);
  return NextResponse.json(payload);
}
