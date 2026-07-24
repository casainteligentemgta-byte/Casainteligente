'use client';

import { ESCALA_FRECUENCIA_PERSONALIDAD } from '@/lib/talento/escalaFrecuenciaPersonalidad';

type Props = {
  disabled: boolean;
  /** Si la sesión ya está lista para enviar (evita confusión mientras carga). */
  sessionReady?: boolean;
  /** Envía un único mensaje de texto (misma API que escribir a mano). */
  onSend: (message: string) => void | Promise<void>;
};

/**
 * Respuestas de selección simple (modo principal en fase guiada).
 */
export default function QuickSelectReplies({ disabled, sessionReady = true, onSend }: Props) {
  const btn =
    'rounded-lg py-2.5 px-3.5 text-sm font-medium border transition-colors disabled:opacity-40 disabled:pointer-events-none min-w-[2.5rem]';
  const btnNeutral = `${btn} bg-zinc-800/90 text-zinc-100 border-zinc-600 hover:bg-zinc-700`;
  const btnAccent = `${btn} bg-sky-900/50 text-sky-100 border-sky-600/50 hover:bg-sky-800/60`;

  return (
    <div className="px-4 pt-3 pb-2 space-y-3 border-b border-zinc-800/80 bg-zinc-950/80">
      <div className="space-y-1">
        <p className="text-xs font-medium text-zinc-200">Tu respuesta — selección simple</p>
        <p className="text-[11px] text-zinc-500 leading-snug">
          Elige una opción. Solo usa texto libre si lo necesitas (enlace debajo).
        </p>
        {!sessionReady ? (
          <p className="text-[11px] text-amber-200/90">Conectando sesión…</p>
        ) : null}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-600 mb-1.5">Frecuencia</p>
        <div className="flex flex-wrap gap-1.5">
          {ESCALA_FRECUENCIA_PERSONALIDAD.map((op) => (
            <button
              key={op.valor}
              type="button"
              disabled={disabled}
              onClick={() => void onSend(`Frecuencia: ${op.etiqueta}.`)}
              className={btnAccent}
            >
              {op.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-600 mb-1.5">Sí / No</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onSend('Respuesta única: Sí.')}
            className={btnNeutral}
          >
            Sí
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onSend('Respuesta única: No.')}
            className={btnNeutral}
          >
            No
          </button>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-zinc-600 mb-1.5">Opción A–D</p>
        <div className="flex flex-wrap gap-1.5">
          {(['A', 'B', 'C', 'D'] as const).map((L) => (
            <button
              key={L}
              type="button"
              disabled={disabled}
              onClick={() => void onSend(`Selección única: opción ${L}.`)}
              className={btnNeutral}
            >
              {L}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
