'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RECRUITMENT_OPENING_LINE } from '@/lib/recruitment/constants';
import type { RecruitmentClientEvent } from '@/types/recruitment';
import SessionShareBar from './SessionShareBar';

type ChatLine = { role: 'user' | 'assistant'; content: string };

const RECRUITMENT_SESSION_STORAGE_KEY = 'casa_inteligente_recruitment_session_v1';

type StoredSession = { sessionId: string; expiresAt: number };

function isValidSessionUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
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
    return { sessionId: parsed.sessionId.trim(), expiresAt: parsed.expiresAt };
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

/** Una sola petición POST en paralelo (Strict Mode) y reutilización al recargar la pestaña. */
let pendingSessionPromise: Promise<StoredSession> | null = null;

function getOrCreateRecruitmentSession(): Promise<StoredSession> {
  const cached = readStoredSession();
  if (cached) return Promise.resolve(cached);
  if (!pendingSessionPromise) {
    pendingSessionPromise = (async () => {
      const res = await fetch('/api/recruitment/session', { method: 'POST' });
      if (!res.ok) throw new Error('session_create_failed');
      const data = (await res.json()) as StoredSession;
      writeStoredSession(data);
      return data;
    })();
  }
  return pendingSessionPromise;
}

export default function ReclutamientoPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fraudWarning, setFraudWarning] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const renewSessionAfterStaleOrMissing = useCallback(async (): Promise<boolean> => {
    clearStoredRecruitmentSession();
    setSessionId(null);
    setExpiresAt(null);
    setSessionComplete(false);
    setFraudWarning(null);
    setLines([{ role: 'assistant', content: RECRUITMENT_OPENING_LINE }]);
    try {
      const fresh = await getOrCreateRecruitmentSession();
      setSessionId(fresh.sessionId);
      setExpiresAt(fresh.expiresAt);
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
      const data = (await res.json()) as {
        warning?: string;
        closed?: boolean;
        reason?: string;
        error?: string;
      };
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
    void getOrCreateRecruitmentSession()
      .then((data) => {
        if (!cancelled) {
          setSessionId(data.sessionId);
          setExpiresAt(data.expiresAt);
          setLines([{ role: 'assistant', content: RECRUITMENT_OPENING_LINE }]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('No se pudo iniciar la sesión. Recarga la página.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function send() {
    const text = input.trim();
    if (!text || !sessionId || loading || sessionComplete) return;
    setInput('');
    setError(null);
    setLines((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = (await res.json()) as {
        assistantMessage?: string;
        error?: string;
        hint?: string;
        sessionComplete?: boolean;
      };
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
  }

  const minsLeft =
    expiresAt != null ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="shrink-0 px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.35)' }}
      >
        <h1 className="text-lg font-semibold text-white">Reclutamiento — fase guiada</h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-prose">
          Esta sesión puede registrar cambios de foco, copiar/pegar y tiempo de respuesta con fines de
          integridad del proceso. Al continuar aceptas este tratamiento conforme a la política de la
          empresa.
        </p>
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
          Sesión finalizada. El evaluador puede consultar el resultado con el ID de sesión.
        </p>
      ) : null}

      <div className="shrink-0 p-4 border-t border-zinc-800 flex gap-2 safe-bottom">
        <input
          className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          placeholder="Escribe tu respuesta…"
          value={input}
          disabled={loading || !sessionId || sessionComplete}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !sessionId || sessionComplete}
          className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white disabled:opacity-40"
        >
          {loading ? '…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
