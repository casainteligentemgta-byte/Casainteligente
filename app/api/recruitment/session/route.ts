import { NextResponse } from 'next/server';
import { createSession } from '@/lib/recruitment/session-store';
import { RECRUITMENT_SESSION_TTL_MS } from '@/lib/recruitment/constants';

export async function POST() {
  const state = await createSession();
  return NextResponse.json({
    sessionId: state.id,
    expiresAt: state.expiresAt,
    ttlMs: RECRUITMENT_SESSION_TTL_MS,
  });
}
