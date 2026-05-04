'use client';

import { motion } from 'framer-motion';
import { calcularRiesgoObrero } from '@/lib/talento/calcularRiesgoObrero';

const GLOW = {
  verde: {
    dot: 'bg-[#10b981]',
    shadow: 'shadow-[0_0_14px_rgba(16,185,129,0.65),0_0_28px_rgba(16,185,129,0.35)]',
    ring: 'ring-emerald-400/40',
  },
  amarillo: {
    dot: 'bg-[#f59e0b]',
    shadow: 'shadow-[0_0_14px_rgba(245,158,11,0.6),0_0_26px_rgba(245,158,11,0.32)]',
    ring: 'ring-amber-400/45',
  },
  rojo: {
    dot: 'bg-[#ff375f]',
    shadow: 'shadow-[0_0_16px_rgba(255,55,95,0.75),0_0_32px_rgba(255,55,95,0.38)]',
    ring: 'ring-[#ff375f]/50',
  },
  sin_datos: {
    dot: 'bg-zinc-500',
    shadow: 'shadow-[0_0_10px_rgba(113,113,122,0.35)]',
    ring: 'ring-zinc-500/30',
  },
} as const;

export type SemaforoRiesgoProps = {
  perfil_color?: string | null;
  puntuacion_logica?: number | null;
  tiempo_respuesta?: number | null;
  /** Texto junto al punto (p. ej. etiqueta corta) */
  mostrarEtiqueta?: boolean;
  className?: string;
};

/**
 * Badge minimalista semáforo de riesgo (obrero) — Elite Black + glow + tooltip nativo.
 */
export default function SemaforoRiesgo({
  perfil_color,
  puntuacion_logica,
  tiempo_respuesta,
  mostrarEtiqueta = true,
  className = '',
}: SemaforoRiesgoProps) {
  const r = calcularRiesgoObrero({ perfil_color, puntuacion_logica, tiempo_respuesta });
  const pal = GLOW[r.nivel === 'sin_datos' ? 'sin_datos' : r.nivel];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md ${className}`}
      title={r.tooltip}
    >
      <motion.span
        layout
        className={`relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ${pal.dot} ${pal.shadow} ${pal.ring}`}
        animate={{
          scale: [1, 1.12, 1],
          opacity: [1, 0.88, 1],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        aria-hidden
      />
      {mostrarEtiqueta ? (
        <span className="min-w-0 truncate text-[11px] font-semibold tracking-tight text-zinc-200">
          {r.etiqueta}
        </span>
      ) : null}
    </span>
  );
}
