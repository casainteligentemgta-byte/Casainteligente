import { NextResponse } from 'next/server';
import { loadSession, normalizeSessionId, saveSession } from '@/lib/recruitment/session-store';
import { FRAUD_CLOSE_THRESHOLD, FRAUD_WARN_THRESHOLD } from '@/lib/recruitment/constants';
import { notifyRecruitmentWhatsApp } from '@/lib/recruitment/whatsapp';
import type { RecruitmentClientEvent } from '@/types/recruitment';

function fraudWeight(e: RecruitmentClientEvent): number {
  switch (e.type) {
    case 'copy':
    case 'paste':
      return 2;
    case 'blur':
    case 'visibility_hidden':
      return 1;
    default:
      return 0;
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    sessionId?: string;
    events?: RecruitmentClientEvent[];
  };
  const sessionId = normalizeSessionId(body.sessionId);
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 });
  }
  const state = await loadSession(sessionId);
  if (!state) {
    return NextResponse.json({ error: 'sesión no encontrada' }, { status: 401 });
  }
  if (state.closed) {
    return NextResponse.json({ error: 'sesión cerrada' }, { status: 401 });
  }
  if (Date.now() > state.expiresAt) {
    state.closed = true;
    state.closeReason = 'expired';
    await saveSession(state);
    await notifyRecruitmentWhatsApp({ sessionId, reason: 'Sesión expirada (15 min)' });
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  const events = Array.isArray(body.events) ? body.events : [];
  for (const e of events) {
    state.events.push(e);
    state.fraudScore += fraudWeight(e);
  }

  let warning: string | undefined;
  if (state.fraudScore >= FRAUD_WARN_THRESHOLD && state.fraudScore < FRAUD_CLOSE_THRESHOLD) {
    warning = 'Detectamos comportamiento inusual. Continúa con transparencia o la sesión puede cerrarse.';
  }
  if (state.fraudScore >= FRAUD_CLOSE_THRESHOLD) {
    state.closed = true;
    state.closeReason = 'fraud';
    await saveSession(state);
    await notifyRecruitmentWhatsApp({
      sessionId,
      reason: 'Cierre por señales de fraude / falta de agilidad operativa',
    });
    return NextResponse.json({ closed: true, reason: 'fraud' }, { status: 403 });
  }

  await saveSession(state);
  return NextResponse.json({ ok: true, fraudScore: state.fraudScore, warning });
}
