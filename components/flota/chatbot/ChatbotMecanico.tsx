'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT } from '@/components/flota/FlotaShell';
import type { FragmentoManual } from '@/lib/flota/chatbot';

type Msg = { role: 'user' | 'bot'; text: string; fuentes?: FragmentoManual[] };

export default function ChatbotMecanico({
  sending,
  onAsk,
}: {
  sending?: boolean;
  onAsk: (pregunta: string) => Promise<{ respuesta: string; fuentes: FragmentoManual[] }>;
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'bot',
      text: 'Soy el mecánico de flota. Pregunte por un síntoma, un intervalo de servicio o un procedimiento. Si cargó un manual, lo uso como referencia.',
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  return (
    <div className="flex min-h-[420px] flex-col rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl bg-[#007AFF] px-3 py-2 text-sm text-white'
                  : 'max-w-[85%] rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100'
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.fuentes?.length ? (
                <p className="mt-2 text-[11px] text-amber-200/80">
                  Fuentes: {m.fuentes.map((f) => f.titulo ?? 'Manual').join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
        ))}
        {sending ? <p className="text-xs text-zinc-500">El mecánico está revisando el manual…</p> : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const pregunta = input.trim();
          if (!pregunta || sending) return;
          setInput('');
          setMessages((m) => [...m, { role: 'user', text: pregunta }]);
          try {
            const r = await onAsk(pregunta);
            setMessages((m) => [...m, { role: 'bot', text: r.respuesta, fuentes: r.fuentes }]);
          } catch (err) {
            setMessages((m) => [
              ...m,
              { role: 'bot', text: err instanceof Error ? err.message : 'No se pudo responder.' },
            ]);
          }
        }}
      >
        <input
          className={FLOTA_INPUT}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ej. La Hilux tira humo blanco al arrancar en frío"
        />
        <Button type="submit" variant="elitePrimary" disabled={sending || !input.trim()}>
          Preguntar
        </Button>
      </form>
    </div>
  );
}
