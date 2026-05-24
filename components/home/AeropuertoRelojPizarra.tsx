'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Un dígito con bisagra central, pila de chapas y animación de volteo. */
function DigitoSplitFlap({
  value,
  compact = false,
}: {
  value: string;
  compact?: boolean;
}) {
  const [display, setDisplay] = useState(value);
  const [prev, setPrev] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === display) return;
    setPrev(display);
    setFlipping(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplay(value);
      setFlipping(false);
    }, 420);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, display]);

  const size = compact ? 'split-flap--compact' : 'split-flap--clock';

  return (
    <div className={`split-flap ${size}`} aria-hidden>
      <div className="split-flap__stack" />
      <div className="split-flap__body">
        <div className="split-flap__upper">
          <span className="split-flap__char">{flipping ? prev : display}</span>
          <span className="split-flap__hinge split-flap__hinge--l" />
          <span className="split-flap__hinge split-flap__hinge--r" />
        </div>
        <div className="split-flap__lower">
          <span className="split-flap__char">{display}</span>
        </div>
        {flipping && (
          <div className="split-flap__flip-top" aria-hidden>
            <span className="split-flap__char">{prev}</span>
            <span className="split-flap__hinge split-flap__hinge--l" />
            <span className="split-flap__hinge split-flap__hinge--r" />
          </div>
        )}
      </div>
    </div>
  );
}

function ColonSplitFlap({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`split-flap-colon ${compact ? 'split-flap-colon--compact' : ''}`}
      aria-hidden
    >
      <span className="split-flap-colon__dot" />
      <span className="split-flap-colon__dot" />
    </div>
  );
}

function RelojSplitFlap({ hh, mm }: { hh: string; mm: string }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" role="timer" aria-live="polite">
      <DigitoSplitFlap value={hh[0]} />
      <DigitoSplitFlap value={hh[1]} />
      <ColonSplitFlap />
      <DigitoSplitFlap value={mm[0]} />
      <DigitoSplitFlap value={mm[1]} />
    </div>
  );
}

function CalendarioSplitFlap({ texto }: { texto: string }) {
  const chars = texto.split('');
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 mt-5">
      {chars.map((c, i) =>
        c === ' ' ? (
          <span key={`sp-${i}`} className="w-1.5 sm:w-2" />
        ) : (
          <DigitoSplitFlap key={`cal-${i}-${c}`} value={c} compact />
        ),
      )}
    </div>
  );
}

export default function AeropuertoRelojPizarra() {
  /** null en SSR y primer paint del cliente → mismo HTML y sin error de hidratación */
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const partes = useMemo(() => {
    if (!now) {
      return { h: '00', m: '00', s: '00', fecha: '───────────────', listo: false };
    }
    const h = pad2(now.getHours());
    const m = pad2(now.getMinutes());
    const s = pad2(now.getSeconds());
    const fecha = now
      .toLocaleDateString('es-VE', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/,/g, '');
    return { h, m, s, fecha, listo: true };
  }, [now]);

  const horaLegible = partes.listo ? `${partes.h}:${partes.m}:${partes.s}` : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05 }}
      className="px-6 mb-6"
    >
      <div
        className="split-flap-board w-full rounded-2xl px-4 py-5 sm:px-8 sm:py-7"
        aria-label={partes.listo ? `Reloj ${horaLegible}. ${partes.fecha}` : 'Reloj'}
      >
        <RelojSplitFlap hh={partes.h} mm={partes.m} />
        <CalendarioSplitFlap texto={partes.fecha} />
        {partes.listo && (
          <p className="mt-4 text-center text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase tabular-nums">
            {partes.s}s
          </p>
        )}
      </div>
    </motion.div>
  );
}
