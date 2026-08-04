'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import {
  bancoEvaluacionUnificadaObrero,
  TOTAL_RECOMENDADO,
} from '@/lib/talento/bancoEvaluacionUnificadaObrero';
import {
  esColorPerfilObrero,
  opcionesDiscVisibles,
  type ColorPerfilObrero,
} from '@/lib/talento/evaluacionObrero';

type Paso =
  | { tipo: 'disc'; idx: number }
  | { tipo: 'logica'; idx: number }
  | { tipo: 'conf'; idx: number }
  | { tipo: 'abc'; idx: number };

type Props = {
  token: string;
  nombre: string;
  cargo?: string;
  codigoGoE?: string;
  rolExamen?: string;
  onFinalizar: () => void;
};

export default function FormularioEvaluacionUnificada({
  token,
  nombre,
  cargo = '',
  codigoGoE = '',
  rolExamen = 'obrero',
  onFinalizar,
}: Props) {
  const banco = useMemo(
    () =>
      bancoEvaluacionUnificadaObrero({
        cargo,
        codigoGoE,
        rolExamen,
        incluirLogica: true,
      }),
    [cargo, codigoGoE, rolExamen],
  );

  const pasos = useMemo<Paso[]>(() => {
    const out: Paso[] = [];
    for (let i = 0; i < banco.disc.length; i++) out.push({ tipo: 'disc', idx: i });
    for (let i = 0; i < banco.logica.length; i++) out.push({ tipo: 'logica', idx: i });
    for (let i = 0; i < banco.confiabilidad.length; i++) out.push({ tipo: 'conf', idx: i });
    for (let i = 0; i < banco.abc.length; i++) out.push({ tipo: 'abc', idx: i });
    return out;
  }, [banco]);

  const [i, setI] = useState(0);
  const [disc, setDisc] = useState<Record<string, ColorPerfilObrero>>({});
  const [logica, setLogica] = useState<Record<string, number>>({});
  const [conf, setConf] = useState<Record<string, number>>({});
  const [abc, setAbc] = useState<Record<string, string>>({});
  const [inicio] = useState(() => Date.now());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = pasos.length;
  const paso = pasos[i]!;
  const progreso = Math.round(((i + 1) / total) * 100);

  const seccionLabel =
    paso.tipo === 'disc'
      ? 'Cómo eres en la obra'
      : paso.tipo === 'logica'
        ? 'Preguntas de obra'
        : paso.tipo === 'conf'
          ? 'Honestidad'
          : banco.etiquetaFamilia
            ? `En la obra · ${banco.etiquetaFamilia}`
            : 'En la obra';

  const pasoRespondido = (): boolean => {
    if (paso.tipo === 'disc') {
      return esColorPerfilObrero(disc[banco.disc[paso.idx]!.id] ?? '');
    }
    if (paso.tipo === 'logica') {
      return typeof logica[banco.logica[paso.idx]!.id] === 'number';
    }
    if (paso.tipo === 'conf') {
      return typeof conf[banco.confiabilidad[paso.idx]!.id] === 'number';
    }
    const v = (abc[banco.abc[paso.idx]!.id] ?? '').toUpperCase();
    return v === 'A' || v === 'B' || v === 'C';
  };

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/talento/examen/evaluar-unificada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          disc,
          logica,
          confiabilidad: conf,
          abc,
          tiempo_respuesta: Math.round((Date.now() - inicio) / 1000),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la evaluación');
      onFinalizar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-zinc-950 px-4 py-6 text-zinc-100">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">Evaluación</p>
        <p className="mt-1 text-sm text-zinc-400">Hola, {nombre}</p>
        <p className="mt-1 text-[11px] text-zinc-600">
          {total} preguntas · recomendado {TOTAL_RECOMENDADO}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>{seccionLabel}</span>
          <span>
            {i + 1} / {total}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </header>

      <main className="flex-1 py-8">
        {paso.tipo === 'disc' ? (
          (() => {
            const q = banco.disc[paso.idx]!;
            const visibles = opcionesDiscVisibles(q, paso.idx);
            const sel = disc[q.id];
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-200">{q.pregunta}</p>
                <p className="text-[11px] text-zinc-500">Escoge una:</p>
                {visibles.map((opt) => (
                  <button
                    key={opt.color}
                    type="button"
                    onClick={() => setDisc((p) => ({ ...p, [q.id]: opt.color }))}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition ${
                      sel === opt.color
                        ? 'border-amber-500/60 bg-amber-500/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    {opt.texto}
                  </button>
                ))}
              </div>
            );
          })()
        ) : null}

        {paso.tipo === 'logica' ? (
          (() => {
            const q = banco.logica[paso.idx]!;
            const sel = logica[q.id];
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-200">{q.texto}</p>
                {q.opciones.map((op, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLogica((p) => ({ ...p, [q.id]: idx }))}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition ${
                      sel === idx
                        ? 'border-sky-500/60 bg-sky-500/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            );
          })()
        ) : null}

        {paso.tipo === 'conf' ? (
          (() => {
            const q = banco.confiabilidad[paso.idx]!;
            const sel = conf[q.id];
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-200">{q.texto}</p>
                {q.opciones.map((op, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setConf((p) => ({ ...p, [q.id]: idx }))}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition ${
                      sel === idx
                        ? 'border-violet-500/60 bg-violet-500/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            );
          })()
        ) : null}

        {paso.tipo === 'abc' ? (
          (() => {
            const q = banco.abc[paso.idx]!;
            const sel = (abc[q.id] ?? '').toUpperCase();
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-200">{q.pregunta}</p>
                {q.opciones.map((op) => (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => setAbc((p) => ({ ...p, [q.id]: op.valor }))}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition ${
                      sel === op.valor.toUpperCase()
                        ? 'border-amber-500/60 bg-amber-500/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300'
                    }`}
                  >
                    {op.texto}
                  </button>
                ))}
              </div>
            );
          })()
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </main>

      <footer className="flex gap-2">
        <button
          type="button"
          disabled={i === 0 || enviando}
          onClick={() => setI((n) => Math.max(0, n - 1))}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-300 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        {i < total - 1 ? (
          <button
            type="button"
            disabled={!pasoRespondido()}
            onClick={() => setI((n) => Math.min(total - 1, n + 1))}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Siguiente
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!pasoRespondido() || enviando}
            onClick={() => void enviar()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Enviar evaluación
          </button>
        )}
      </footer>
    </div>
  );
}
