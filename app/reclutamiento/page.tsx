'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RECRUITMENT_OPENING_LINE } from '@/lib/recruitment/constants';
import type { RecruitmentClientEvent } from '@/types/recruitment';
import QuickSelectReplies from '@/components/reclutamiento/QuickSelectReplies';
import ReclutamientoHojaVidaBlock from '@/components/reclutamiento/ReclutamientoHojaVidaBlock';
import SessionShareBar from './SessionShareBar';

type ChatLine = { role: 'user' | 'assistant'; content: string };

const RECRUITMENT_SESSION_STORAGE_KEY = 'casa_inteligente_recruitment_session_v2';

type StoredSession = {
  sessionId: string;
  expiresAt: number;
  needId: string | null;
  openingLine?: string;
};

function isValidSessionUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function normalizeNeedId(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  return isValidSessionUuid(t) ? t : null;
}

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(RECRUITMENT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.sessionId || typeof parsed.expiresAt !== 'number') return null;
    if (!isValidSessionUuid(parsed.sessionId)) return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return {
      sessionId: parsed.sessionId.trim(),
      expiresAt: parsed.expiresAt,
      needId: parsed.needId ?? null,
      openingLine: parsed.openingLine,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(data: StoredSession) {
  try {
    sessionStorage.setItem(RECRUITMENT_SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function clearStoredRecruitmentSession() {
  try {
    sessionStorage.removeItem(RECRUITMENT_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  pendingSessionPromise = null;
}

let pendingSessionPromise: Promise<StoredSession & { openingLine: string }> | null = null;

/** Evita `res.json()` con cuerpo vacío (502/HTML) → "Unexpected end of JSON input". */
async function readFetchJson<T extends Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function getOrCreateRecruitmentSession(needId: string | null): Promise<StoredSession & { openingLine: string }> {
  const wantNeed = needId ?? null;
  const cached = readStoredSession();
  if (
    cached &&
    (cached.needId ?? null) === wantNeed &&
    cached.expiresAt > Date.now()
  ) {
    return Promise.resolve({
      ...cached,
      openingLine: cached.openingLine ?? RECRUITMENT_OPENING_LINE,
    });
  }
  if (cached && (cached.needId ?? null) !== wantNeed) {
    clearStoredRecruitmentSession();
  }

  if (pendingSessionPromise) return pendingSessionPromise;

  pendingSessionPromise = (async () => {
    try {
      const res = await fetch('/api/recruitment/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wantNeed ? { needId: wantNeed } : {}),
      });
      const data = await readFetchJson<{
        sessionId?: string;
        expiresAt?: number;
        openingLine?: string;
        needId?: string | null;
        error?: string;
        hint?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(
          [data.error, data.hint].filter(Boolean).join(' — ') ||
            `session_create_failed (HTTP ${res.status})`,
        );
      }
      if (!data.sessionId || typeof data.expiresAt !== 'number') {
        throw new Error(
          'La API de sesión devolvió un cuerpo vacío o no JSON. Revisa /api/recruitment/session y la red.',
        );
      }
      const openingLine = data.openingLine ?? RECRUITMENT_OPENING_LINE;
      const stored: StoredSession = {
        sessionId: data.sessionId,
        expiresAt: data.expiresAt,
        needId: wantNeed,
        openingLine,
      };
      writeStoredSession(stored);
      return { ...stored, openingLine };
    } finally {
      pendingSessionPromise = null;
    }
  })();

  return pendingSessionPromise;
}

function ReclutamientoPageInner() {
  const searchParams = useSearchParams();
  const rawNeed = searchParams.get('need');
  const needFromUrl = normalizeNeedId(rawNeed);
  const needInvalid = rawNeed != null && rawNeed.trim() !== '' && needFromUrl === null;

  const needRef = useRef<string | null>(null);
  useEffect(() => {
    needRef.current = needFromUrl;
  }, [needFromUrl]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fraudWarning, setFraudWarning] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  /** Texto libre colapsado por defecto: la fase guiada prioriza selección simple. */
  const [freeTextOpen, setFreeTextOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const renewSessionAfterStaleOrMissing = useCallback(async (): Promise<boolean> => {
    clearStoredRecruitmentSession();
    setSessionId(null);
    setExpiresAt(null);
    setSessionComplete(false);
    setFreeTextOpen(false);
    setFraudWarning(null);
    setLines([{ role: 'assistant', content: RECRUITMENT_OPENING_LINE }]);
    try {
      const fresh = await getOrCreateRecruitmentSession(needRef.current);
      setSessionId(fresh.sessionId);
      setExpiresAt(fresh.expiresAt);
      setLines([{ role: 'assistant', content: fresh.openingLine }]);
      setError(null);
      return true;
    } catch {
      setError('No se pudo crear una nueva sesión. Recarga la página.');
      return false;
    }
  }, []);

  const pushEvents = useCallback(
    async (events: RecruitmentClientEvent[]) => {
      if (!sessionId || events.length === 0) return;
      const res = await fetch('/api/recruitment/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, events }),
      });
      const data = await readFetchJson<{
        warning?: string;
        closed?: boolean;
        reason?: string;
        error?: string;
      }>(res);
      if (data.warning) setFraudWarning(data.warning);
      if (!res.ok) {
        if (data.reason === 'fraud') {
          setError('La sesión se cerró por señales de fraude o falta de agilidad operativa.');
          setSessionComplete(true);
          return;
        }
        const shouldRenew =
          data.error === 'sesión no encontrada' ||
          data.error === 'expired' ||
          res.status === 410;
        if (shouldRenew) {
          await renewSessionAfterStaleOrMissing();
        }
      }
    },
    [sessionId, renewSessionAfterStaleOrMissing],
  );

  useEffect(() => {
    let cancelled = false;
    void getOrCreateRecruitmentSession(needFromUrl)
      .then((data) => {
        if (!cancelled) {
          setSessionId(data.sessionId);
          setExpiresAt(data.expiresAt);
          setLines([{ role: 'assistant', content: data.openingLine }]);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Error al iniciar sesión';
          setError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needFromUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    if (!sessionId) return;
    const onBlur = () => {
      void pushEvents([{ type: 'blur', at: Date.now() }]);
    };
    const onCopy = () => {
      void pushEvents([{ type: 'copy', at: Date.now() }]);
    };
    const onPaste = () => {
      void pushEvents([{ type: 'paste', at: Date.now() }]);
    };
    const onVis = () => {
      void pushEvents([
        {
          type: document.visibilityState === 'hidden' ? 'visibility_hidden' : 'visibility_visible',
          at: Date.now(),
        },
      ]);
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('copy', onCopy);
    window.addEventListener('paste', onPaste);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('paste', onPaste);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [sessionId, pushEvents]);

  const sendMessage = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || !sessionId || loading || sessionComplete) return;
      setInput('');
      setError(null);
      setLines((prev) => [...prev, { role: 'user', content: t }]);
      setLoading(true);
      try {
        const res = await fetch('/api/recruitment/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: t }),
        });
        const data = await readFetchJson<{
          assistantMessage?: string;
          error?: string;
          hint?: string;
          sessionComplete?: boolean;
        }>(res);
        if (!res.ok) {
          const shouldRenewSession =
            data.error === 'sesión no encontrada' ||
            data.error === 'expired' ||
            res.status === 410;
          if (shouldRenewSession) {
            await renewSessionAfterStaleOrMissing();
            return;
          }
          const msg = [data.error, data.hint].filter(Boolean).join(' — ');
          setError(msg || 'Error al enviar');
          return;
        }
        if (data.assistantMessage) {
          setLines((prev) => [...prev, { role: 'assistant', content: data.assistantMessage! }]);
        }
        if (data.sessionComplete) setSessionComplete(true);
      } catch {
        setError('No se pudo conectar. Revisa tu red.');
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading, sessionComplete, renewSessionAfterStaleOrMissing],
  );

  async function send() {
    await sendMessage(input);
  }

  const minsLeft =
    expiresAt != null ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="shrink-0 px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.35)' }}
      >
        <h1 className="text-lg font-semibold text-white">Reclutamiento — hoja de vida y entrevista</h1>
        <p className="text-xs text-zinc-300 mt-1 max-w-prose">
          Si RRHH te envió un enlace con vacante, primero completa la <strong className="text-zinc-200">hoja de vida</strong>{' '}
          (datos básicos arriba); puedes hacerlo antes, durante o después de la entrevista guiada. Luego responde con los
          botones de abajo (escala 1–5, Sí/No o A–D). El texto libre es opcional.
        </p>
        <p className="text-[11px] text-zinc-500 mt-2 max-w-prose">
          Esta sesión puede registrar cambios de foco, copiar/pegar y tiempo de respuesta con fines de
          integridad del proceso. Al continuar aceptas este tratamiento conforme a la política de la
          empresa.
        </p>
        {needFromUrl ? (
          <p className="text-[11px] text-emerald-300/90 mt-2">
            Protocolo activo: vacante vinculada (ID {needFromUrl.slice(0, 8)}…).
          </p>
        ) : (
          <p className="text-[11px] text-zinc-500 mt-2">
            Modo abierto (sin vacante). Para asociar al puesto, abre el enlace que envía RRHH con{' '}
            <code className="text-zinc-400">?need=</code>.
          </p>
        )}
        {needInvalid ? (
          <p className="text-[11px] text-amber-400 mt-2">
            El parámetro <code className="text-amber-200">need</code> no es un UUID válido; se ignora.
          </p>
        ) : null}
        {sessionId ? (
          <p className="text-[10px] text-zinc-500 mt-2 font-mono break-all">ID sesión: {sessionId}</p>
        ) : null}
        {minsLeft != null ? (
          <p className="text-[11px] text-amber-200/90 mt-2">Tiempo restante (aprox.): {minsLeft} min</p>
        ) : null}
        {fraudWarning ? (
          <p className="text-[11px] text-amber-300 mt-1">{fraudWarning}</p>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {needFromUrl && !needInvalid && sessionId ? (
          <ReclutamientoHojaVidaBlock sessionId={sessionId} needId={needFromUrl} />
        ) : null}
        {lines.map((line, i) => (
          <div
            key={`${i}-${line.role}`}
            className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm ${
              line.role === 'user'
                ? 'ml-auto bg-blue-600/90 text-white'
                : 'mr-auto bg-zinc-800 text-zinc-100 border border-zinc-700'
            }`}
          >
            {line.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="px-4 text-sm text-red-400 shrink-0">{error}</p>
      ) : null}
      {sessionComplete ? (
        <p className="px-4 pb-2 text-sm text-emerald-400 shrink-0">
          Entrevista guiada finalizada. Si aún no guardaste la hoja de vida de arriba, puedes hacerlo ahora; el
          evaluador puede consultar el resultado con el ID de sesión.
        </p>
      ) : null}

      {/* Pie fijo: selección simple como vía principal; texto libre colapsado. */}
      <footer
        className="shrink-0 border-t border-zinc-800/90 bg-[rgba(0,0,0,0.45)] backdrop-blur-sm safe-bottom"
        style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.35)' }}
      >
        {!sessionComplete ? (
          <QuickSelectReplies
            disabled={loading || !sessionId}
            sessionReady={!!sessionId}
            onSend={(msg) => void sendMessage(msg)}
          />
        ) : null}
        {!sessionComplete ? (
          freeTextOpen ? (
            <div className="px-4 pb-2 pt-0 space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                  placeholder="Escribe tu respuesta libre…"
                  value={input}
                  disabled={loading || !sessionId || sessionComplete}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  aria-label="Respuesta libre al cuestionario"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !sessionId || sessionComplete}
                  className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white disabled:opacity-40 shrink-0"
                >
                  {loading ? '…' : 'Enviar'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFreeTextOpen(false);
                  setInput('');
                }}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
              >
                Cerrar y usar solo selección simple
              </button>
            </div>
          ) : (
            <div className="px-4 pb-3 pt-1">
              <button
                type="button"
                onClick={() => setFreeTextOpen(true)}
                disabled={loading || !sessionId || sessionComplete}
                className="text-xs text-sky-300/95 hover:text-sky-200 underline underline-offset-2 disabled:opacity-40"
              >
                Escribir respuesta libre (opcional)
              </button>
            </div>
          )
        ) : null}
        {sessionId ? (
          <div className="px-4 pb-3 pt-0">
            <SessionShareBar sessionId={sessionId} />
          </div>
        ) : null}
      </footer>
    </div>
  );
}

export default function ReclutamientoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm" style={{ background: 'var(--bg-primary)' }}>
          Cargando reclutamiento…
        </div>
      }
    >
      <ReclutamientoPageInner />
    </Suspense>
  );
}
