'use client';

import { useState } from 'react';
import { Loader2, Scale, Send } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import { LEGAL_CATEGORIAS } from '@/lib/legal/legalKnowledgeMetadata';

type Fuente = {
  index: number;
  referencia: string | null;
  source: string | null;
  categoria: string | null;
  tipo: string | null;
  similarity: number;
  excerpt: string;
};

export default function AsesorLegalClient() {
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState<string>('laboral');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [fuentes, setFuentes] = useState<Fuente[]>([]);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setRespuesta(null);
    setFuentes([]);

    try {
      const res = await fetch(apiUrl('/api/legal/knowledge/consultar'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          categoria: categoria || null,
          match_threshold: 0.65,
          match_count: 6,
        }),
      });
      const data = (await res.json()) as {
        respuesta?: string;
        fuentes?: Fuente[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      setRespuesta(data.respuesta ?? '');
      setFuentes(data.fuentes ?? []);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Scale className="h-4 w-4" />
          Abogado Senior · Derecho Venezolano
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">Asesor legal (RAG)</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Respuestas basadas en la base de conocimiento ingestada. Cita fundamentos y
          declara incertidumbre cuando el contexto no alcanza.
        </p>
      </header>

      <form
        onSubmit={consultar}
        className="space-y-3 rounded-2xl border border-amber-500/20 bg-[#0c1018] p-4"
      >
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Categoría
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Todas</option>
            {LEGAL_CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Consulta
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
            placeholder="Ej.: ¿Cómo se calcula la prestación de antigüedad según la LOTTT?"
            className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Consultar
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {respuesta && (
        <article className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">
            Dictamen
          </h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
            {respuesta}
          </div>
          {fuentes.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Fuentes recuperadas
              </h4>
              <ul className="mt-2 space-y-2">
                {fuentes.map((f) => (
                  <li
                    key={`${f.index}-${f.referencia ?? f.source ?? f.index}`}
                    className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-zinc-400"
                  >
                    <span className="font-semibold text-zinc-300">
                      [Fuente {f.index}: {f.referencia || f.source || 'sin referencia'}]
                    </span>
                    {typeof f.similarity === 'number' && (
                      <span className="ml-2 text-zinc-600">
                        {(f.similarity * 100).toFixed(0)}%
                      </span>
                    )}
                    <p className="mt-1 line-clamp-3 text-zinc-500">{f.excerpt}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
