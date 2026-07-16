import { NextResponse } from 'next/server';
import { loadSession, normalizeSessionId, saveSession } from '@/lib/recruitment/session-store';
import { analyzeRecruitmentTurn } from '@/lib/recruitment/gemini';
import { shouldConfront } from '@/lib/recruitment/policy-engine';
import { classifyConfrontationResponse } from '@/lib/recruitment/confrontation-classify';
import {
  TURNS_PER_BLOCK,
  TOTAL_BLOCKS,
} from '@/lib/recruitment/constants';
import { notifyRecruitmentWhatsApp } from '@/lib/recruitment/whatsapp';

export async function POST(req: Request) {
  const body = (await req.json()) as { sessionId?: string; message?: string };
  const sessionId = normalizeSessionId(body.sessionId);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId y message requeridos' }, { status: 400 });
  }

  const state = await loadSession(sessionId);
  if (!state) {
    return NextResponse.json(
      {
        error: 'sesión no encontrada',
        hint: 'Reinicia la entrevista o revisa que la base tenga la sesión (RLS/pooler en Supabase).',
      },
      { status: 401 },
    );
  }
  if (state.closed) {
    return NextResponse.json({ error: 'sesión cerrada', reason: state.closeReason }, { status: 401 });
  }
  if (Date.now() > state.expiresAt) {
    state.closed = true;
    state.closeReason = 'expired';
    await saveSession(state);
    await notifyRecruitmentWhatsApp({ sessionId, reason: 'Sesión expirada (15 min)' });
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  if (
    state.currentBlock === TOTAL_BLOCKS &&
    state.turnInBlock >= TURNS_PER_BLOCK &&
    !state.pendingConfrontation
  ) {
    return NextResponse.json({ error: 'session_completed' }, { status: 400 });
  }

  const now = Date.now();

  // Respuesta a confrontación pendiente
  if (state.pendingConfrontation) {
    const outcome = classifyConfrontationResponse(message);
    state.confrontations.push({
      at: now,
      blockIndex: state.currentBlock,
      hook: state.pendingConfrontation.hook,
      candidateResponse: message,
      outcome,
    });
    state.pendingConfrontation = undefined;
    state.history.push({ role: 'user', content: message, at: now });

    const turnIndex = state.history.filter((h) => h.role === 'user').length;
    const analysis = await analyzeRecruitmentTurn({
      turnIndex,
      history: state.history.map((h) => ({ role: h.role, content: h.content })),
    });
    state.analyses.push(analysis);

    const assistantMsg =
      analysis.assistantReply ??
      'Gracias por la aclaración. Sigamos: ¿qué harías si un cliente exige un plazo imposible?';
    state.history.push({ role: 'assistant', content: assistantMsg, at: Date.now() });
    await saveSession(state);

    return NextResponse.json({
      assistantMessage: assistantMsg,
      analysis,
      confrontation: false,
      currentBlock: state.currentBlock,
      turnInBlock: state.turnInBlock,
      sessionComplete: state.closed,
    });
  }

  // Nuevo turno (incrementa contador de bloque salvo que luego sea confrontación)
  state.turnInBlock += 1;
  if (state.turnInBlock > TURNS_PER_BLOCK) {
    if (state.currentBlock < TOTAL_BLOCKS) {
      state.currentBlock += 1;
      state.turnInBlock = 1;
      state.confrontationsThisBlock = 0;
    }
  }

  state.history.push({ role: 'user', content: message, at: now });

  const turnIndex = state.history.filter((h) => h.role === 'user').length;
  const analysis = await analyzeRecruitmentTurn({
    turnIndex,
    history: state.history.map((h) => ({ role: h.role, content: h.content })),
  });
  state.analyses.push(analysis);

  const decision = shouldConfront(state, analysis);
  if (decision.triggerConfrontation && decision.confrontationHook) {
    state.pendingConfrontation = { hook: decision.confrontationHook, sinceTurn: turnIndex };
    state.confrontationsThisBlock += 1;
    const assistantMsg = `Necesito afinar un punto: ${decision.confrontationHook}`;
    state.history.push({ role: 'assistant', content: assistantMsg, at: Date.now() });
    await saveSession(state);
    return NextResponse.json({
      assistantMessage: assistantMsg,
      analysis,
      confrontation: true,
      currentBlock: state.currentBlock,
      turnInBlock: state.turnInBlock,
      sessionComplete: false,
    });
  }

  const assistantMsg =
    analysis.assistantReply ??
    'Gracias. ¿Puedes describir un conflicto con un cliente y cómo lo cerraste?';
  state.history.push({ role: 'assistant', content: assistantMsg, at: Date.now() });

  if (state.currentBlock === TOTAL_BLOCKS && state.turnInBlock === TURNS_PER_BLOCK) {
    state.closed = true;
    state.closeReason = 'completed';
  }

  await saveSession(state);

  return NextResponse.json({
    assistantMessage: assistantMsg,
    analysis,
    confrontation: false,
    currentBlock: state.currentBlock,
    turnInBlock: state.turnInBlock,
    sessionComplete: state.closed,
  });
}
