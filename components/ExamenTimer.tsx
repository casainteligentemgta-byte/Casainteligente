'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export type ExamenTimerProps = {
  /** Segundos hasta el fin (p. ej. 900 = 15 min). */
  expiraEnSegundos: number;
  /** Se ejecuta una sola vez al llegar a 0 (bloquear UI, intentar guardar, etc.). */
  onFinish: () => void;
  /** Si cambia, reinicia el contador (p. ej. id de intento de examen). */
  resetKey?: string | number;
  className?: string;
};

/**
 * Temporizador de cuenta regresiva para el examen de talento.
 */
export default function ExamenTimer({
  expiraEnSegundos,
  onFinish,
  resetKey,
  className,
}: ExamenTimerProps) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor(expiraEnSegundos)));
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const triggerFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinishRef.current();
  }, []);

  useEffect(() => {
    finishedRef.current = false;
    const initial = Math.max(0, Math.floor(expiraEnSegundos));
    setSeconds(initial);
    if (initial <= 0) {
      queueMicrotask(() => triggerFinish());
      return;
    }

    const id = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          queueMicrotask(() => triggerFinish());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [expiraEnSegundos, resetKey, triggerFinish]);

  const urgent = seconds > 0 && seconds <= 60;

  return (
    <div
      className={
        className ??
        `fixed top-4 right-4 z-50 rounded-2xl px-4 py-3 font-mono text-sm font-bold shadow-lg border ${
          urgent
            ? 'border-amber-400/60 bg-amber-600 text-white animate-pulse'
            : 'border-red-500/40 bg-red-600 text-white'
        }`
      }
      role="timer"
      aria-live="polite"
      aria-label={`Tiempo restante: ${formatTime(seconds)}`}
    >
      Tiempo: {formatTime(seconds)}
    </div>
  );
}
