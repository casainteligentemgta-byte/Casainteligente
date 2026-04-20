import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { RECRUITMENT_SESSION_TTL_MS } from '@/lib/recruitment/constants';
import { createSession } from '@/lib/recruitment/session-store';

export async function POST(req: Request) {
  let needId: string | undefined;
  try {
    const body = (await req.json()) as { needId?: string };
    needId = body.needId?.trim();
  } catch {
    needId = undefined;
  }

  let needTitle: string | undefined;
  if (needId) {
    if (!db) {
      return NextResponse.json(
        {
          error: 'database_unavailable',
          hint: 'DATABASE_URL no configurada; no se puede validar la vacante (?need=).',
        },
        { status: 503 },
      );
    }
    const rows = await db
      .select({
        title: schema.recruitmentNeeds.title,
        protocolActive: schema.recruitmentNeeds.protocolActive,
      })
      .from(schema.recruitmentNeeds)
      .where(eq(schema.recruitmentNeeds.id, needId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { error: 'need_not_found', hint: 'La necesidad de puesto no existe. Crea una en el dashboard CEO.' },
        { status: 400 },
      );
    }
    if (!row.protocolActive) {
      return NextResponse.json(
        { error: 'protocol_inactive', hint: 'El protocolo para esta vacante está desactivado.' },
        { status: 403 },
      );
    }
    needTitle = row.title;
  }

  const state = await createSession(undefined, needId ? { needId, needTitle } : undefined);
  const openingLine = state.history[0]?.content ?? '';

  return NextResponse.json({
    sessionId: state.id,
    expiresAt: state.expiresAt,
    ttlMs: RECRUITMENT_SESSION_TTL_MS,
    needId: state.needId ?? null,
    openingLine,
  });
}
