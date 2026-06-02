'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function DigitoSplitFlap({
  value,
  size = 'clock',
}: {
  value: string;
  size?: 'clock' | 'clock-sm' | 'compact' | 'compact-sm';
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

  const sizeClass =
    size === 'clock-sm'
      ? 'split-flap--clock-sm'
      : size === 'compact-sm'
        ? 'split-flap--compact-sm'
        : size === 'compact'
          ? 'split-flap--compact'
          : 'split-flap--clock';

  return (
    <div className={cn('split-flap', sizeClass)} aria-hidden>
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

function ColonSplitFlap({ size = 'clock' }: { size?: 'clock' | 'clock-sm' | 'compact-sm' }) {
  const cls =
    size === 'clock-sm'
      ? 'split-flap-colon split-flap-colon--clock-sm'
      : size === 'compact-sm'
        ? 'split-flap-colon split-flap-colon--compact-sm'
        : 'split-flap-colon';
  return (
    <div className={cls} aria-hidden>
      <span className="split-flap-colon__dot" />
      <span className="split-flap-colon__dot" />
    </div>
  );
}

function RelojSplitFlap({ hh, mm, dense }: { hh: string; mm: string; dense?: boolean }) {
  const digitSize = dense ? 'clock-sm' : 'clock';
  const colonSize = dense ? 'clock-sm' : 'clock';
  return (
    <div
      className="flex items-center justify-center gap-1.5 sm:gap-2 landscape:gap-1"
      role="timer"
      aria-live="polite"
    >
      <DigitoSplitFlap value={hh[0]} size={digitSize} />
      <DigitoSplitFlap value={hh[1]} size={digitSize} />
      <ColonSplitFlap size={colonSize} />
      <DigitoSplitFlap value={mm[0]} size={digitSize} />
      <DigitoSplitFlap value={mm[1]} size={digitSize} />
    </div>
  );
}

function CalendarioSplitFlap({ texto, dense }: { texto: string; dense?: boolean }) {
  const chars = texto.split('');
  const digitSize = dense ? 'compact-sm' : 'compact';
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-0.5 sm:gap-1',
        dense ? 'mt-2 landscape:mt-1.5' : 'mt-5',
      )}
    >
      {chars.map((c, i) =>
        c === ' ' ? (
          <span key={`sp-${i}`} className="w-1 sm:w-1.5" />
        ) : (
          <DigitoSplitFlap key={`cal-${i}-${c}`} value={c} size={digitSize} />
        ),
      )}
    </div>
  );
}

type Props = {
  className?: string;
  dense?: boolean;
};

export default function AeropuertoRelojPizarra({ className, dense = false }: Props) {
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
    <div
      className={cn('min-h-0 flex flex-col justify-center', dense ? 'px-0 mb-0' : 'px-6 mb-6', className)}
    >
      <div
        className={cn(
          'split-flap-board w-full rounded-xl sm:rounded-2xl',
          dense ? 'split-flap-board--dense' : 'px-4 py-5 sm:px-8 sm:py-7',
        )}
        aria-label={partes.listo ? `Reloj ${horaLegible}. ${partes.fecha}` : 'Reloj'}
      >
        <RelojSplitFlap hh={partes.h} mm={partes.m} dense={dense} />
        <CalendarioSplitFlap texto={partes.fecha} dense={dense} />
        {partes.listo && !dense && (
          <p className="mt-4 text-center text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase tabular-nums">
            {partes.s}s
          </p>
        )}
        {partes.listo && dense && (
          <p className="mt-1.5 text-center text-[9px] font-semibold tracking-[0.15em] text-white/20 uppercase tabular-nums landscape:mt-1">
            {partes.s}s
          </p>
        )}
      </div>
    </div>
  );
}
