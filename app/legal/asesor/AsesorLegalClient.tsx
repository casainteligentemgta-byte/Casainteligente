'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Gavel,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Scale,
  Send,
  Swords,
} from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  ASESOR_MAX_PREGUNTAS,
  ASESOR_MODULOS,
  moduloPorCategoria,
  submoduloLabel,
} from '@/lib/legal/asesorCasoCatalogo';
import {
  LEGAL_CATEGORIAS,
  LEGAL_CATEGORIA_LABELS,
} from '@/lib/legal/legalKnowledgeMetadata';
import { useSpeechDictation } from '@/lib/legal/useSpeechDictation';

type Fuente = {
  index: number;
  referencia: string | null;
  source: string | null;
  categoria: string | null;
  tipo: string | null;
  similarity: number;
  excerpt: string;
};

type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Dictamen = {
  hechos_asumidos: string;
  analisis_juridico: string;
  normativa: string;
  jurisprudencia: string;
  recomendacion: string;
  vista_contraparte: string;
  replica_sugerida: string;
  lagunas_e_incertidumbre: string;
  texto_completo: string;
};

type Modo = 'caso' | 'rapida';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AsesorLegalClient() {
  const [modo, setModo] = useState<Modo>('caso');
  const [categoria, setCategoria] = useState<string>('laboral');
  const [submodulo, setSubmodulo] = useState<string>('despido');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hechos, setHechos] = useState('');
  const [preguntasHechas, setPreguntasHechas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dictamen, setDictamen] = useState<Dictamen | null>(null);
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [fase, setFase] = useState<'idle' | 'pregunta' | 'dictamen'>('idle');

  // Consulta rápida (legacy)
  const [queryRapida, setQueryRapida] = useState('');
  const [respuestaRapida, setRespuestaRapida] = useState<string | null>(null);
  const [fuentesRapidas, setFuentesRapidas] = useState<Fuente[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const submodulos = moduloPorCategoria(categoria)?.submodulos ?? [];

  const speech = useSpeechDictation({
    lang: 'es-VE',
    onFinal: (t) => {
      setDraft((prev) => (prev ? `${prev.trim()} ${t}` : t));
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, dictamen, loading]);

  useEffect(() => {
    const first = moduloPorCategoria(categoria)?.submodulos[0]?.id ?? '';
    setSubmodulo((prev) => {
      const stillValid = moduloPorCategoria(categoria)?.submodulos.some(
        (s) => s.id === prev,
      );
      return stillValid ? prev : first;
    });
  }, [categoria]);

  function reiniciarCaso() {
    speech.stop();
    setMessages([]);
    setHechos('');
    setPreguntasHechas(0);
    setDictamen(null);
    setFuentes([]);
    setFase('idle');
    setError(null);
    setDraft('');
  }

  async function enviarTurno(opts?: { forzar?: boolean; text?: string }) {
    const text = (opts?.text ?? draft).trim();
    if (loading) return;
    if (!opts?.forzar && !text) return;
    if (fase === 'dictamen' && !opts?.forzar) return;

    speech.stop();
    setLoading(true);
    setError(null);

    const nextMessages: ChatMsg[] = text
      ? [...messages, { id: uid(), role: 'user', content: text }]
      : messages;

    if (text) {
      setMessages(nextMessages);
      setDraft('');
    }

    try {
      const payloadMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (!payloadMessages.length) {
        setError('Cuente el caso primero (texto o micrófono).');
        setLoading(false);
        return;
      }

      const res = await fetch(apiUrl('/api/legal/knowledge/asesor-caso'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          categoria: categoria || null,
          submodulo: submodulo || null,
          hechos_consolidados: hechos || null,
          forzar_dictamen: Boolean(opts?.forzar),
        }),
      });

      const data = (await res.json()) as {
        fase?: 'pregunta' | 'dictamen';
        mensaje?: string;
        categoria?: string | null;
        submodulo?: string | null;
        hechos_consolidados?: string;
        preguntas_hechas?: number;
        dictamen?: Dictamen | null;
        fuentes?: Fuente[];
        error?: string;
        hint?: string;
      };

      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }

      if (data.categoria) setCategoria(data.categoria);
      if (data.submodulo) setSubmodulo(data.submodulo);
      if (data.hechos_consolidados) setHechos(data.hechos_consolidados);
      if (typeof data.preguntas_hechas === 'number') {
        setPreguntasHechas(data.preguntas_hechas);
      }

      if (data.fase === 'dictamen' && data.dictamen) {
        setFase('dictamen');
        setDictamen(data.dictamen);
        setFuentes(data.fuentes ?? []);
        if (data.mensaje) {
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: 'assistant', content: data.mensaje! },
          ]);
        }
        return;
      }

      setFase('pregunta');
      if (data.mensaje) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'assistant', content: data.mensaje! },
        ]);
      }
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  async function consultaRapida(e: React.FormEvent) {
    e.preventDefault();
    const q = queryRapida.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setRespuestaRapida(null);
    setFuentesRapidas([]);

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
      setRespuestaRapida(data.respuesta ?? '');
      setFuentesRapidas(data.fuentes ?? []);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  const progresoPct = Math.min(
    100,
    Math.round((preguntasHechas / ASESOR_MAX_PREGUNTAS) * 100),
  );
  const labelSub = submoduloLabel(categoria, submodulo);

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Scale className="h-4 w-4" />
          Abogado Senior · Laboral · Civil · Mercantil · Tributario · Corporativo
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">Asesoría legal</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Atiende cualquier rama del derecho venezolano. Exponga el caso por texto o
          micrófono: el asesor hace hasta {ASESOR_MAX_PREGUNTAS} preguntas clave y
          emite un dictamen con normativa, jurisprudencia recuperada y la vista del
          abogado contrario.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModo('caso')}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            modo === 'caso'
              ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40'
              : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Caso dinámico
        </button>
        <button
          type="button"
          onClick={() => setModo('rapida')}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            modo === 'rapida'
              ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40'
              : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Consulta rápida
        </button>
      </div>

      {modo === 'caso' ? (
        <>
          <section className="grid gap-3 rounded-2xl border border-amber-500/20 bg-[#0c1018] p-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Módulo / categoría
              <select
                value={categoria}
                disabled={fase !== 'idle' && messages.length > 0}
                onChange={(e) => setCategoria(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              >
                {ASESOR_MODULOS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Submódulo
              <select
                value={submodulo}
                disabled={fase !== 'idle' && messages.length > 0}
                onChange={(e) => setSubmodulo(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
              >
                {submodulos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {(fase === 'pregunta' || fase === 'dictamen') && (
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>
                    Preguntas {preguntasHechas}/{ASESOR_MAX_PREGUNTAS}
                    {labelSub ? ` · ${labelSub}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={reiniciarCaso}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-amber-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reiniciar
                  </button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-700 transition-all duration-500"
                    style={{ width: `${progresoPct}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="flex min-h-[280px] flex-col rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-zinc-500">
                  Cuente el caso como si hablara con su abogado: qué pasó, quiénes
                  intervienen, fechas, documentos y qué busca lograr. Puede usar el
                  micrófono.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-auto bg-amber-500/15 text-amber-50'
                      : 'mr-auto border border-white/10 bg-black/30 text-zinc-200'
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {m.role === 'user' ? 'Usted' : 'Abogado Senior'}
                  </p>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
              {loading && (
                <p className="inline-flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analizando…
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {fase !== 'dictamen' && (
              <div className="border-t border-white/10 p-3">
                {speech.interim && (
                  <p className="mb-2 text-xs italic text-zinc-500">
                    Escuchando: {speech.interim}
                  </p>
                )}
                {speech.error && (
                  <p className="mb-2 text-xs text-red-300">{speech.error}</p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder={
                      messages.length === 0
                        ? 'Ej.: Un obrero reclama reenganche tras despido del 10 de marzo…'
                        : 'Responda la pregunta del abogado…'
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void enviarTurno();
                      }
                    }}
                    className="min-h-[44px] flex-1 resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => speech.toggle()}
                    disabled={!speech.supported || loading}
                    title={
                      speech.supported
                        ? speech.listening
                          ? 'Detener micrófono'
                          : 'Dictar por micrófono'
                        : 'Dictado no disponible en este navegador'
                    }
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                      speech.listening
                        ? 'border-red-400/50 bg-red-500/20 text-red-200'
                        : 'border-white/15 bg-white/5 text-zinc-300 hover:border-amber-500/40 hover:text-amber-100'
                    } disabled:opacity-40`}
                  >
                    {speech.listening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={loading || !draft.trim()}
                    onClick={() => void enviarTurno()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 text-sm font-bold text-black disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar
                  </button>
                </div>
                {messages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void enviarTurno({ forzar: true, text: 'Dictamina ya con lo que tienes.' })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"
                    >
                      <Gavel className="h-3.5 w-3.5" />
                      Dictaminar ahora
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {dictamen && (
            <article className="space-y-4 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-[#0c1018] to-[#07090f] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">
                Dictamen
              </h3>
              <DictamenBloque titulo="Hechos asumidos" body={dictamen.hechos_asumidos} />
              <DictamenBloque titulo="Análisis jurídico" body={dictamen.analisis_juridico} />
              <DictamenBloque titulo="Normativa aplicable" body={dictamen.normativa} />
              <DictamenBloque
                titulo="Jurisprudencia / precedentes"
                body={dictamen.jurisprudencia}
              />
              <DictamenBloque titulo="Recomendación práctica" body={dictamen.recomendacion} />
              <div className="rounded-xl border border-rose-500/25 bg-rose-950/20 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-200/90">
                  <Swords className="h-3.5 w-3.5" />
                  Vista de la contraparte
                </p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                  {dictamen.vista_contraparte || '—'}
                </div>
              </div>
              <DictamenBloque titulo="Réplica sugerida" body={dictamen.replica_sugerida} />
              <DictamenBloque
                titulo="Lagunas e incertidumbre"
                body={dictamen.lagunas_e_incertidumbre}
              />
              <FuentesList fuentes={fuentes} />
              <button
                type="button"
                onClick={reiniciarCaso}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-300 hover:border-amber-500/40 hover:text-amber-100"
              >
                <RotateCcw className="h-4 w-4" />
                Nuevo caso
              </button>
            </article>
          )}
        </>
      ) : (
        <form
          onSubmit={consultaRapida}
          className="space-y-3 rounded-2xl border border-amber-500/20 bg-[#0c1018] p-4"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Categoría
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Todas las ramas</option>
              {LEGAL_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {LEGAL_CATEGORIA_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Consulta
            <textarea
              value={queryRapida}
              onChange={(e) => setQueryRapida(e.target.value)}
              rows={4}
              placeholder="Ej.: ¿Cómo se calcula la prestación de antigüedad según la LOTTT?"
              className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !queryRapida.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Consultar
          </button>
          {respuestaRapida && (
            <article className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">
                Dictamen
              </h3>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {respuestaRapida}
              </div>
              <FuentesList fuentes={fuentesRapidas} />
            </article>
          )}
        </form>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

function DictamenBloque({ titulo, body }: { titulo: string; body: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{titulo}</h4>
      <div className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
        {body?.trim() || '—'}
      </div>
    </div>
  );
}

function FuentesList({ fuentes }: { fuentes: Fuente[] }) {
  if (!fuentes.length) return null;
  return (
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
            {f.tipo && (
              <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">
                {f.tipo}
              </span>
            )}
            <p className="mt-1 line-clamp-3 text-zinc-500">{f.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
