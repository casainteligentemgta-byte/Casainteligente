'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import {
  PARES_DISC_OBRERO,
  PREGUNTAS_CONFIABILIDAD_OBRERO,
  PREGUNTAS_LOGICA_OBRERO,
  totalPasosEvaluacionObrero,
  type ColorPerfilObrero,
} from '@/lib/talento/evaluacionObrero';

type Paso =
  | { tipo: 'disc'; idx: number }
  | { tipo: 'logica'; idx: number }
  | { tipo: 'conf'; idx: number };

type Props = {
  token: string;
  nombre: string;
  onFinalizar: (resultado: {
    perfil_color: ColorPerfilObrero;
    puntuacion_logica: number;
    puntuacion_confiabilidad: number;
    semaforo_riesgo: string | null;
    motivo: string | null;
  }) => void;
};

export default function FormularioEvaluacionColor({ token, nombre, onFinalizar }: Props) {
  const pasos = useMemo<Paso[]>(() => {
    const out: Paso[] = [];
    for (let i = 0; i < PARES_DISC_OBRERO.length; i++) out.push({ tipo: 'disc', idx: i });
    for (let i = 0; i < PREGUNTAS_LOGICA_OBRERO.length; i++) out.push({ tipo: 'logica', idx: i });
    for (let i = 0; i < PREGUNTAS_CONFIABILIDAD_OBRERO.length; i++) out.push({ tipo: 'conf', idx: i });
    return out;
  }, []);

  const [i, setI] = useState(0);
  const [disc, setDisc] = useState<Record<string, 'a' | 'b'>>({});
  const [logica, setLogica] = useState<Record<string, number>>({});
  const [conf, setConf] = useState<Record<string, number>>({});
  const [inicio] = useState(() => Date.now());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = totalPasosEvaluacionObrero();
  const paso = pasos[i]!;
  const progreso = Math.round(((i + 1) / total) * 100);

  const responderDisc = (id: string, v: 'a' | 'b') => {
    setDisc((prev) => ({ ...prev, [id]: v }));
  };
  const responderLogica = (id: string, v: number) => {
    setLogica((prev) => ({ ...prev, [id]: v }));
  };
  const responderConf = (id: string, v: number) => {
    setConf((prev) => ({ ...prev, [id]: v }));
  };

  const pasoRespondido = (): boolean => {
    if (paso.tipo === 'disc') {
      const id = PARES_DISC_OBRERO[paso.idx]!.id;
      return disc[id] === 'a' || disc[id] === 'b';
    }
    if (paso.tipo === 'logica') {
      const id = PREGUNTAS_LOGICA_OBRERO[paso.idx]!.id;
      return typeof logica[id] === 'number';
    }
    const id = PREGUNTAS_CONFIABILIDAD_OBRERO[paso.idx]!.id;
    return typeof conf[id] === 'number';
  };

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/talento/examen/evaluar-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          disc,
          logica,
          confiabilidad: conf,
          tiempo_respuesta: Math.round((Date.now() - inicio) / 1000),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        perfil_color?: ColorPerfilObrero;
        puntuacion_logica?: number;
        puntuacion_confiabilidad?: number;
        semaforo_riesgo?: string | null;
        motivo?: string | null;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la evaluación');
      onFinalizar({
        perfil_color: data.perfil_color ?? 'Verde',
        puntuacion_logica: data.puntuacion_logica ?? 0,
        puntuacion_confiabilidad: data.puntuacion_confiabilidad ?? 0,
        semaforo_riesgo: data.semaforo_riesgo ?? null,
        motivo: data.motivo ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setEnviando(false);
    }
  };

  const seccionLabel =
    paso.tipo === 'disc'
      ? 'Cómo eres en la obra'
      : paso.tipo === 'logica'
        ? 'Preguntas de obra'
        : 'Honestidad en la obra';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-zinc-950 px-4 py-6 text-zinc-100">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">
          Evaluación
        </p>
        <p className="mt-1 text-sm text-zinc-400">Hola, {nombre}</p>
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
            const par = PARES_DISC_OBRERO[paso.idx]!;
            const sel = disc[par.id];
            return (
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-200">
                  ¿Cuál te queda mejor en la obra? Escoge una:
                </p>
                {(
                  [
                    ['a', par.a],
                    ['b', par.b],
                  ] as const
                ).map(([key, opt]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => responderDisc(par.id, key)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left text-sm transition ${
                      sel === key
                        ? 'border-amber-500/60 bg-amber-500/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]'
                    }`}
                  >
                    {/* Sin etiqueta de color: el obrero elige por conducta, no por color. */}
                    <span className="sr-only">{opt.color}</span>
                    {opt.texto}
                  </button>
                ))}
              </div>
            );
          })()
        ) : null}

        {paso.tipo === 'logica' ? (
          (() => {
            const q = PREGUNTAS_LOGICA_OBRERO[paso.idx]!;
            const sel = logica[q.id];
            return (
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-200">{q.texto}</p>
                {q.opciones.map((op, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => responderLogica(q.id, idx)}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition ${
                      sel === idx
                        ? 'border-sky-500/60 bg-sky-500/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]'
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
            const q = PREGUNTAS_CONFIABILIDAD_OBRERO[paso.idx]!;
            const sel = conf[q.id];
            return (
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-200">{q.texto}</p>
                {q.opciones.map((op, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => responderConf(q.id, idx)}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition ${
                      sel === idx
                        ? 'border-violet-500/60 bg-violet-500/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]'
                    }`}
                  >
                    {op}
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
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Enviar evaluación
          </button>
        )}
      </footer>
    </div>
  );
}
