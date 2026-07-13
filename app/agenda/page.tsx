'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CATEGORIA_LABELS,
  type AgendaChatMessage,
  type CategoriaFechaEspecial,
  type LlmProvider,
  type SpecialDate,
} from '@/types/agenda';

const PROVIDERS: { id: LlmProvider; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'openai', label: 'OpenAI' },
];

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-VE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

export default function AgendaPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<SpecialDate[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [provider, setProvider] = useState<LlmProvider>('gemini');
  const [messages, setMessages] = useState<AgendaChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch('/api/agenda/events');
      if (res.status === 401) {
        router.push('/login?next=/agenda');
        return;
      }
      const json = (await res.json()) as { data?: SpecialDate[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar eventos');
      setEvents(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoadingEvents(false);
    }
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login?next=/agenda');
        return;
      }
      setUserEmail(user.email ?? null);
      loadEvents();
    });
  }, [loadEvents, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login?next=/agenda');
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages: AgendaChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/agenda/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, messages: nextMessages }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error en el chat');

      setMessages((prev) => [...prev, { role: 'assistant', text: json.reply ?? 'Listo.' }]);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/agenda/events?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'No se pudo eliminar');
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const now = new Date();
  const monthLabel = now.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-primary)', paddingBottom: '100px' }}
    >
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p style={{ fontSize: '15px', color: 'var(--label-tertiary)', margin: 0 }}>Personal</p>
            <h1
              className="font-bold tracking-tight"
              style={{ fontSize: '34px', color: 'var(--label-primary)', margin: '4px 0 0' }}
            >
              Agenda
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginTop: '6px' }}>
              {monthLabel}
              {userEmail ? ` · ${userEmail}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--glass-border)',
              color: 'var(--label-secondary)',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Salir
          </button>
        </div>
      </div>

      <div className="px-5 mb-4">
        <div
          className="flex gap-2 p-1 rounded-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
        >
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '14px',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                background: provider === p.id ? 'rgba(0,122,255,0.2)' : 'transparent',
                color: provider === p.id ? '#007AFF' : 'var(--label-tertiary)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--label-tertiary)' }}>
          Recordatorios por Telegram: 1 día antes y el mismo día (si guardaste eventos desde el bot).
        </p>
      </div>

      <div className="px-5 grid gap-4 lg:grid-cols-2">
        <section>
          <h2
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--label-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
            }}
          >
            Próximos eventos
          </h2>

          {loadingEvents ? (
            <p style={{ color: 'var(--label-secondary)', fontSize: '14px' }}>Cargando…</p>
          ) : events.length === 0 ? (
            <div
              className="rounded-2xl p-5 text-center"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <p style={{ fontSize: '28px', margin: '0 0 8px' }}>📅</p>
              <p style={{ color: 'var(--label-secondary)', fontSize: '14px', margin: 0 }}>
                Sin eventos aún. Pídele al asistente que guarde uno.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl p-4 flex items-start justify-between gap-3"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#FF9500',
                        textTransform: 'uppercase',
                      }}
                    >
                      {CATEGORIA_LABELS[event.category as CategoriaFechaEspecial] ?? event.category}
                    </p>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--label-primary)',
                      }}
                    >
                      {event.title}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--label-secondary)' }}>
                      {formatDate(event.event_date)}
                      {event.event_time ? ` · ${formatTime(event.event_time)}` : ''}
                    </p>
                    {event.notes ? (
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--label-tertiary)' }}>
                        {event.notes}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(event.id)}
                    aria-label="Eliminar evento"
                    style={{
                      background: 'rgba(255,59,48,0.12)',
                      border: 'none',
                      color: '#FF3B30',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="rounded-2xl flex flex-col"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--glass-border)',
            minHeight: '420px',
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--label-primary)' }}>
              Asistente de agenda
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--label-tertiary)' }}>
              Powered by {provider === 'openai' ? 'OpenAI' : 'Gemini'}
            </p>
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
            style={{ maxHeight: '320px' }}
          >
            {messages.length === 0 ? (
              <p style={{ color: 'var(--label-tertiary)', fontSize: '13px', margin: 0 }}>
                Ej: &quot;Guarda el cumpleaños de María el 15 de agosto&quot;
              </p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    padding: '10px 14px',
                    borderRadius: '16px',
                    background:
                      msg.role === 'user'
                        ? 'rgba(0,122,255,0.2)'
                        : 'rgba(255,255,255,0.08)',
                    color: 'var(--label-primary)',
                    fontSize: '14px',
                    lineHeight: 1.45,
                  }}
                >
                  {msg.text}
                </div>
              ))
            )}
            {sending ? (
              <p style={{ color: 'var(--label-tertiary)', fontSize: '13px', margin: 0 }}>
                Pensando…
              </p>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          {error ? (
            <p style={{ margin: '0 16px 8px', fontSize: '12px', color: '#FF3B30' }}>{error}</p>
          ) : null}

          <div className="p-3 flex gap-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Escribe un mensaje…"
              disabled={sending}
              style={{
                flex: 1,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '14px',
                padding: '12px 14px',
                color: 'var(--label-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              style={{
                background: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                padding: '0 18px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: sending ? 'wait' : 'pointer',
                opacity: sending || !input.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </section>
      </div>

      <div className="px-5 mt-4">
        <Link href="/" style={{ color: 'var(--label-tertiary)', fontSize: '13px' }}>
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
