import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { RECRUITMENT_SESSION_TTL_MS } from '@/lib/recruitment/constants';
import { createSession } from '@/lib/recruitment/session-store';
import {
  resolveSupabasePostgrestCreds,
  restFetchRecruitmentNeedMeta,
} from '@/lib/supabase/postgrest-server';

export async function POST(req: Request) {
  try {
    let needId: string | undefined;
    try {
      const body = (await req.json()) as { needId?: string };
      needId = body.needId?.trim();
    } catch {
      needId = undefined;
    }

    let needTitle: string | undefined;
    if (needId) {
      let title: string | null = null;
      let protocolActive = true;
      let resolved = false;

      const creds = resolveSupabasePostgrestCreds();
      if (creds) {
        const meta = await restFetchRecruitmentNeedMeta(creds, needId);
        if (meta.kind === 'not_found') {
          return NextResponse.json(
            {
              error: 'need_not_found',
              hint: 'La necesidad de puesto no existe. Crea una en el dashboard CEO.',
            },
            { status: 400 },
          );
        }
        if (meta.kind === 'row') {
          title = meta.title;
          protocolActive = meta.protocolActive;
          resolved = true;
        }
      }

      if (!resolved && db) {
        try {
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
              {
                error: 'need_not_found',
                hint: 'La necesidad de puesto no existe. Crea una en el dashboard CEO.',
              },
              { status: 400 },
            );
          }
          title = row.title;
          protocolActive = row.protocolActive;
          resolved = true;
        } catch (e) {
          console.error('[recruitment/session] Drizzle need lookup', e);
        }
      }

      if (!resolved) {
        return NextResponse.json(
          {
            error: 'need_lookup_unavailable',
            hint:
              'No se pudo validar la vacante (?need=). Configura NEXT_PUBLIC_SUPABASE_URL + clave (anon o service role) o DATABASE_URL alineada con Supabase.',
          },
          { status: 503 },
        );
      }

      if (!protocolActive) {
        return NextResponse.json(
          { error: 'protocol_inactive', hint: 'El protocolo para esta vacante está desactivado.' },
          { status: 403 },
        );
      }
      needTitle = title ?? undefined;
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
  } catch (e) {
    console.error('[recruitment/session POST]', e);
    const msg = (e instanceof Error ? e.message : String(e)).trim() || 'Error desconocido';
    return NextResponse.json(
      { error: 'session_create_failed', hint: msg.slice(0, 500) },
      { status: 500 },
    );
  }
}
