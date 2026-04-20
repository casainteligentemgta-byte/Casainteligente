import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createInitialSession, type RecruitmentSessionState } from '@/lib/recruitment/session-state';
import { randomUUID } from 'crypto';
import { RECRUITMENT_OPENING_LINE, RECRUITMENT_SESSION_TTL_MS } from '@/lib/recruitment/constants';

const memory = new Map<string, RecruitmentSessionState>();

/** Normaliza UUID (trim); evita espacios raros del cliente. */
export function normalizeSessionId(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

function rowToState(row: { id: string; state: unknown; expiresAt: Date }): RecruitmentSessionState {
  const s = row.state as RecruitmentSessionState;
  s.id = row.id;
  s.expiresAt = row.expiresAt.getTime();
  return s;
}

export async function loadSession(id: string): Promise<RecruitmentSessionState | null> {
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.recruitmentSessions)
        .where(eq(schema.recruitmentSessions.id, id))
        .limit(1);
      const row = rows[0];
      if (row) {
        try {
          return rowToState(row);
        } catch (e) {
          console.error('[recruitment] rowToState corrupto', e);
        }
      }
    } catch (e) {
      console.error('[recruitment] loadSession DB error, usando memoria si existe', e);
    }
  }
  return memory.get(id) ?? null;
}

export async function saveSession(state: RecruitmentSessionState): Promise<void> {
  const expiresAt = new Date(state.expiresAt);
  if (db) {
    try {
      const existing = await db
        .select({ id: schema.recruitmentSessions.id })
        .from(schema.recruitmentSessions)
        .where(eq(schema.recruitmentSessions.id, state.id))
        .limit(1);
      if (existing[0]) {
        await db
          .update(schema.recruitmentSessions)
          .set({ state: state as object, expiresAt })
          .where(eq(schema.recruitmentSessions.id, state.id));
      } else {
        await db.insert(schema.recruitmentSessions).values({
          id: state.id,
          state: state as object,
          expiresAt,
        });
      }
      return;
    } catch (e) {
      console.error('[recruitment] saveSession DB error, fallback a memoria', e);
    }
  }
  memory.set(state.id, { ...state });
}

export async function createSession(
  id?: string,
  opts?: { needId?: string; needTitle?: string },
): Promise<RecruitmentSessionState> {
  const sid = id ?? randomUUID();
  const now = Date.now();
  const state = createInitialSession(sid, now, RECRUITMENT_SESSION_TTL_MS);
  if (opts?.needId) state.needId = opts.needId;
  if (opts?.needTitle) state.needTitle = opts.needTitle;
  const opening =
    opts?.needTitle?.trim() != null && opts.needTitle.trim().length > 0
      ? `${RECRUITMENT_OPENING_LINE} — Vacante: ${opts.needTitle.trim()}.`
      : RECRUITMENT_OPENING_LINE;
  state.history.push({ role: 'assistant', content: opening, at: now });
  await saveSession(state);
  return state;
}

/** Limpia memoria (solo tests / dev). */
export function _clearMemoryStore() {
  memory.clear();
}
