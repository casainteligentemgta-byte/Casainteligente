'use client';

import { useRef, useState } from 'react';
import ExamenTimer from '@/components/ExamenTimer';
import type { PreguntaExamenMovil } from '@/types/talento';

export type ExamenMovilProps = {
  preguntas: PreguntaExamenMovil[];
  onFinish: (respuestas: Record<string, string>) => void;
  /** Por defecto 15 min (900 s), alineado con `/talento/examen`. */
  expiraEnSegundos?: number;
  /** Reinicia el temporizador (p. ej. al iniciar un nuevo intento). */
  timerResetKey?: string | number;
  className?: string;
};

/**
 * Examen móvil paso a paso: una pregunta por pantalla, opciones grandes, barra de progreso.
 * Compatible con `logicaAPreguntasMovil` / bancos tipo `ci_preguntas` (opciones `{ texto }`).
 */
export default function ExamenMovil({
  preguntas,
  onFinish,
  expiraEnSegundos = 900,
  timerResetKey,
  className = '',
}: ExamenMovilProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const respuestasRef = useRef<Record<string, string>>({});
  respuestasRef.current = respuestas;

  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const handleOptionSelect = (preguntaId: string, opcionTexto: string) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: opcionTexto }));
    window.setTimeout(() => {
      setCurrentStep((step) => (step < preguntas.length - 1 ? step + 1 : step));
    }, 300);
  };

  const handleTimerEnd = () => {
    finishRef.current({ ...respuestasRef.current });
  };

  const handleFinalizar = () => {
    finishRef.current({ ...respuestasRef.current });
  };

  if (preguntas.length === 0) {
    return (
      <p className="text-sm text-zinc-400 px-4 py-6" role="status">
        No hay preguntas para mostrar.
      </p>
    );
  }

  const p = preguntas[Math.min(currentStep, preguntas.length - 1)];

  return (
    <div
      className={`min-h-screen flex flex-col p-4 font-sans select-none bg-zinc-950 text-zinc-100 ${className}`}
    >
      <ExamenTimer
        expiraEnSegundos={expiraEnSegundos}
        resetKey={timerResetKey}
        onFinish={handleTimerEnd}
        className="fixed top-4 right-4 z-50 rounded-2xl px-4 py-3 font-mono text-sm font-bold shadow-lg border border-red-500/40 bg-red-600 text-white"
      />

      <div className="w-full bg-zinc-800 h-2 rounded-full mt-16 mb-8">
        <div
          className="bg-sky-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep + 1) / preguntas.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider mb-2">
          Pregunta {currentStep + 1} de {preguntas.length}
        </span>
        <h2 className="text-2xl font-semibold text-zinc-100 leading-tight mb-8">{p.pregunta}</h2>

        <div className="space-y-4">
          {p.opciones.map((opcion, idx) => (
            <button
              key={`${p.id}-${idx}`}
              type="button"
              onClick={() => handleOptionSelect(p.id, opcion.texto)}
              className={`w-full text-left p-5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                respuestas[p.id] === opcion.texto
                  ? 'border-sky-500 bg-sky-950/60 text-sky-100'
                  : 'border-zinc-700 bg-zinc-900/80 text-zinc-200 shadow-sm hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center">
                <span className="w-8 h-8 rounded-full border border-zinc-600 flex items-center justify-center mr-4 text-sm shrink-0">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-lg font-medium">{opcion.texto}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-between items-center text-zinc-500 p-2 safe-bottom">
        <button
          type="button"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          className="px-4 py-2 rounded-xl hover:bg-zinc-800 disabled:opacity-30"
          disabled={currentStep === 0}
        >
          Anterior
        </button>
        {currentStep === preguntas.length - 1 && (
          <button
            type="button"
            onClick={handleFinalizar}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg"
          >
            FINALIZAR
          </button>
        )}
      </div>
    </div>
  );
}
