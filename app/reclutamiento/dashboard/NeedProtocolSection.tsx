'use client';

import { useCallback, useEffect, useState } from 'react';

type NeedRow = {
  id: string;
  title: string;
  notes: string | null;
  protocolActive: boolean;
  createdAt: string;
};

export default function NeedProtocolSection() {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<NeedRow | null>(null);
  const [needs, setNeeds] = useState<NeedRow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/recruitment/needs');
      const data = (await res.json()) as { needs?: NeedRow[]; error?: string };
      if (res.ok && data.needs) setNeeds(data.needs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recruitment/needs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, notes: notes.trim() || undefined }),
      });
      const data = (await res.json()) as NeedRow & { error?: string; hint?: string };
      if (!res.ok) {
        setError([data.error, (data as { hint?: string }).hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      setLastCreated(data);
      setTitle('');
      setNotes('');
      void load();
    } catch {
      setError('No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 mb-8 space-y-4">
      <h2 className="text-sm font-semibold text-white">1. Necesidad de puesto → protocolo</h2>
      <p className="text-xs text-zinc-400">
        Registra la vacante aquí. Se activa el enlace de entrevista con <code className="text-zinc-300">?need=</code>{' '}
        para que la sesión quede asociada al puesto.
      </p>

      <form onSubmit={(e) => void crear(e)} className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Título del puesto *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Técnico de instalación domótica — Caracas"
            className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Requisitos, ubicación, urgencia…"
            className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white resize-y min-h-[3rem]"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="rounded-xl px-4 py-2 text-sm font-medium bg-emerald-700 text-white disabled:opacity-40"
        >
          {loading ? 'Guardando…' : 'Registrar y activar protocolo'}
        </button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {lastCreated?.id ? (
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/20 p-3 text-xs space-y-2">
          <p className="text-emerald-200 font-medium">Protocolo listo para esta vacante</p>
          <p className="text-zinc-400">Comparte con el candidato (entrevista guiada):</p>
          <code className="block break-all text-[11px] text-sky-300 bg-black/40 p-2 rounded-lg">
            {origin}/reclutamiento?need={lastCreated.id}
          </code>
        </div>
      ) : null}

      {needs.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase text-zinc-500 mb-2">Vacantes recientes</p>
          <ul className="space-y-2 text-xs">
            {needs.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 border border-zinc-800 rounded-lg p-2">
                <span className="text-zinc-200">{n.title}</span>
                <code className="text-[10px] text-sky-400/90 break-all">
                  {origin}/reclutamiento?need={n.id}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
