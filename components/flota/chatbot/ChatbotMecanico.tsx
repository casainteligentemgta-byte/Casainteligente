'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/http/apiUrl';

export function ChatbotMecanico() {
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/flota/chatbot'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta }),
      });

      const data = await res.json();
      setRespuesta(data.respuesta ?? (data.error ? `Error: ${data.error}` : ''));
    } catch (error) {
      setRespuesta(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-lg font-semibold text-white">Asistente mecánico</h3>

      <form onSubmit={(e) => void handleAsk(e)} className="space-y-2">
        <input
          type="text"
          placeholder="Ej: ¿Cómo cambio el aceite?"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-white placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-amber-500 p-2 font-medium text-black disabled:bg-zinc-600 disabled:text-zinc-300"
        >
          {loading ? 'Pensando...' : 'Preguntar'}
        </button>
      </form>

      {respuesta && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <p className="whitespace-pre-wrap text-sm text-zinc-100">{respuesta}</p>
        </div>
      )}
    </div>
  );
}

export default ChatbotMecanico;
