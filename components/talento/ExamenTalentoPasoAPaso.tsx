'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import ExamenTimer from '@/components/ExamenTimer';
import type { PasoExamenTalento } from '@/lib/talento/examenPasos';

type Props = {
  pasos: PasoExamenTalento[];
  expiraEnSegundos?: number;
  timerResetKey?: string | number;
  onTimerFinish?: () => void;
  disabled?: boolean;
  enviando?: boolean;
  error?: string | null;
  onSubmit: (respuestas: {
    personalidad: Record<string, number>;
    logica: Record<string, number>;
  }) => void;
};

export default function ExamenTalentoPasoAPaso({
  pasos,
  expiraEnSegundos = 900,
  timerResetKey,
  onTimerFinish,
  disabled = false,
  enviando = false,
  error = null,
  onSubmit,
}: Props) {
  const [indice, setIndice] = useState(0);
  const [personalidad, setPersonalidad] = useState<Record<string, number>>({});
  const [logica, setLogica] = useState<Record<string, number>>({});

  const paso = pasos[indice];
  const total = pasos.length;
  const progreso = total > 0 ? Math.round(((indice + 1) / total) * 100) : 0;

  const valorActual = useMemo(() => {
    if (!paso) return undefined;
    return paso.seccion === 'personalidad' ? personalidad[paso.id] : logica[paso.id];
  }, [paso, personalidad, logica]);

  const seleccionar = (valor: number) => {
    if (!paso || disabled) return;
    if (paso.seccion === 'personalidad') {
      setPersonalidad((prev) => ({ ...prev, [paso.id]: valor }));
    } else {
      setLogica((prev) => ({ ...prev, [paso.id]: valor }));
    }
  };

  const puedeAvanzar = valorActual !== undefined && !disabled && !enviando;

  const irSiguiente = () => {
    if (!puedeAvanzar) return;
    if (indice < total - 1) setIndice((i) => i + 1);
  };

  const irAnterior = () => {
    if (indice > 0) setIndice((i) => i - 1);
  };

  const finalizar = () => {
    if (!puedeAvanzar || indice !== total - 1) return;
    onSubmit({ personalidad, logica });
  };

  if (!paso || total === 0) {
    return (
      <p className="text-sm text-zinc-400 py-8 text-center" role="status">
        No hay preguntas para mostrar.
      </p>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex justify-end mb-2">
        <ExamenTimer
          expiraEnSegundos={expiraEnSegundos}
          resetKey={timerResetKey}
          onFinish={() => onTimerFinish?.()}
          className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 font-mono text-sm font-bold text-red-200"
        />
      </div>

      <header className="mb-6">
        <div className="flex justify-between items-center text-xs text-zinc-500 mb-2">
          <span className="uppercase tracking-wider text-sky-400 font-semibold">
            {paso.bloque ?? (paso.seccion === 'logica' ? 'Lógica' : 'Conducta')}
          </span>
          <span>
            Pregunta {indice + 1} de {total}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-sky-600 transition-all duration-300"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center">
        <h2 className="text-xl sm:text-2xl font-medium text-zinc-100 leading-snug mb-6">{paso.pregunta}</h2>
        <div className="flex flex-col gap-3">
          {paso.opciones.map((op, idx) => {
            const elegida = valorActual === op.valor;
            return (
              <button
                key={`${paso.id}-${idx}`}
                type="button"
                disabled={disabled || enviando}
                onClick={() => seleccionar(op.valor)}
                className={`w-full text-left p-4 rounded-xl border-2 text-base transition-all active:scale-[0.99] ${
                  elegida
                    ? 'border-sky-500 bg-sky-950/50 text-sky-100'
                    : 'border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:border-zinc-600'
                } disabled:opacity-40`}
              >
                <span className="font-bold mr-2 text-zinc-400">{String.fromCharCode(65 + idx)}.</span>
                {op.texto}
              </button>
            );
          })}
        </div>
      </main>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <footer className="mt-8 flex gap-3 pb-4">
        <button
          type="button"
          onClick={irAnterior}
          disabled={indice === 0 || enviando}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Atrás
        </button>
        {indice < total - 1 ? (
          <button
            type="button"
            onClick={irSiguiente}
            disabled={!puedeAvanzar}
            className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            Siguiente
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={finalizar}
            disabled={!puedeAvanzar}
            className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {enviando ? 'Enviando…' : 'Finalizar'}
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </footer>
    </div>
  );
}
