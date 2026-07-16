'use client';

import { useEffect, useState } from 'react';

type Deporte = 'nadar' | 'bici' | 'trotar';

const DEPORTES: { id: Deporte; etiqueta: string }[] = [
  { id: 'nadar', etiqueta: 'Nadando…' },
  { id: 'bici', etiqueta: 'Pedaleando…' },
  { id: 'trotar', etiqueta: 'Trotando…' },
];

type Props = {
  open: boolean;
  pct: number;
  actual: number;
  total: number;
  etapa?: string;
};

const STYLES = `
@keyframes csv-nadar { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes csv-brazo-nadar { 0%,100%{transform:rotate(-18deg)} 50%{transform:rotate(28deg)} }
@keyframes csv-pierna-nadar { 0%,100%{transform:rotate(12deg)} 50%{transform:rotate(-22deg)} }
@keyframes csv-ola { 0%,100%{transform:translateX(0)} 50%{transform:translateX(6px)} }
@keyframes csv-rueda { to { transform: rotate(360deg); } }
@keyframes csv-bici-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
@keyframes csv-pedal { 0%,100%{transform:rotate(-18deg)} 50%{transform:rotate(18deg)} }
@keyframes csv-trotar { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-5px) translateX(3px)} }
@keyframes csv-brazo-trotar { 0%,100%{transform:rotate(-22deg)} 50%{transform:rotate(22deg)} }
@keyframes csv-pierna-trotar { 0%,100%{transform:rotate(18deg)} 50%{transform:rotate(-18deg)} }
@keyframes csv-polvo { 0%{opacity:.6;transform:scale(.6)} 100%{opacity:0;transform:scale(1.6) translateX(-8px)} }
.csv-anim-nadar { animation: csv-nadar 0.9s ease-in-out infinite; transform-origin: center; }
.csv-anim-brazo-nadar { animation: csv-brazo-nadar 0.7s ease-in-out infinite; transform-origin: 34px 38px; }
.csv-anim-pierna-nadar { animation: csv-pierna-nadar 0.7s ease-in-out infinite; transform-origin: 58px 42px; }
.csv-anim-ola { animation: csv-ola 1.2s ease-in-out infinite; }
.csv-anim-ola2 { animation: csv-ola 1.6s ease-in-out infinite reverse; }
.csv-anim-rueda { animation: csv-rueda 0.6s linear infinite; }
.csv-anim-bici-bob { animation: csv-bici-bob 0.5s ease-in-out infinite; }
.csv-anim-pedal { animation: csv-pedal 0.5s ease-in-out infinite; transform-origin: 46px 42px; }
.csv-anim-trotar { animation: csv-trotar 0.55s ease-in-out infinite; }
.csv-anim-brazo-trotar { animation: csv-brazo-trotar 0.55s ease-in-out infinite; transform-origin: 50px 30px; }
.csv-anim-pierna-trotar { animation: csv-pierna-trotar 0.55s ease-in-out infinite; transform-origin: 50px 42px; }
.csv-anim-polvo { animation: csv-polvo 0.55s ease-out infinite; }
`;

function MunecoNadar() {
  return (
    <svg viewBox="0 0 96 72" className="h-20 w-28" aria-hidden>
      <path
        className="csv-anim-ola"
        fill="rgba(56,189,248,0.3)"
        d="M0 48 Q12 40 24 48 T48 48 T72 48 T96 48 V72 H0 Z"
      />
      <path
        className="csv-anim-ola2"
        fill="rgba(125,211,252,0.25)"
        d="M0 54 Q16 46 32 54 T64 54 T96 54 V72 H0 Z"
      />
      <g className="csv-anim-nadar">
        <circle cx="48" cy="28" r="7" fill="#fde68a" />
        <ellipse cx="48" cy="40" rx="14" ry="5" fill="#34d399" />
        <path
          d="M34 38 Q26 32 22 28"
          className="csv-anim-brazo-nadar"
          stroke="#fde68a"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M58 42 Q68 46 74 40"
          className="csv-anim-pierna-nadar"
          stroke="#fde68a"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function MunecoBici() {
  return (
    <svg viewBox="0 0 96 72" className="h-20 w-28" aria-hidden>
      <line x1="8" y1="62" x2="88" y2="62" stroke="#52525b" strokeWidth="2" />
      <g className="csv-anim-rueda" style={{ transformOrigin: '28px 54px' }}>
        <circle cx="28" cy="54" r="10" stroke="#d4d4d8" strokeWidth="2.5" fill="none" />
        <line x1="28" y1="44" x2="28" y2="64" stroke="#a1a1aa" strokeWidth="1.5" />
        <line x1="18" y1="54" x2="38" y2="54" stroke="#a1a1aa" strokeWidth="1.5" />
      </g>
      <g className="csv-anim-rueda" style={{ transformOrigin: '68px 54px' }}>
        <circle cx="68" cy="54" r="10" stroke="#d4d4d8" strokeWidth="2.5" fill="none" />
        <line x1="68" y1="44" x2="68" y2="64" stroke="#a1a1aa" strokeWidth="1.5" />
        <line x1="58" y1="54" x2="78" y2="54" stroke="#a1a1aa" strokeWidth="1.5" />
      </g>
      <path
        d="M28 54 L44 36 L60 54 M44 36 L56 36 L68 54"
        stroke="#818cf8"
        strokeWidth="2.5"
        fill="none"
        strokeLinejoin="round"
      />
      <g className="csv-anim-bici-bob">
        <circle cx="48" cy="22" r="6" fill="#fde68a" />
        <line x1="48" y1="28" x2="46" y2="42" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
        <path d="M46 34 L56 36" stroke="#fde68a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path
          d="M46 42 L40 52 M46 42 L52 50"
          className="csv-anim-pedal"
          stroke="#fde68a"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function MunecoTrotar() {
  return (
    <svg viewBox="0 0 96 72" className="h-20 w-28" aria-hidden>
      <line x1="8" y1="64" x2="88" y2="64" stroke="#52525b" strokeWidth="2" />
      <circle cx="30" cy="62" r="2" className="csv-anim-polvo" fill="rgba(113,113,122,0.5)" />
      <g className="csv-anim-trotar">
        <circle cx="50" cy="18" r="7" fill="#fde68a" />
        <line x1="50" y1="25" x2="50" y2="42" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
        <path
          d="M50 30 L38 38 M50 30 L62 26"
          className="csv-anim-brazo-trotar"
          stroke="#fde68a"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M50 42 L40 56 M50 42 L62 54"
          className="csv-anim-pierna-trotar"
          stroke="#fde68a"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function MunecoDeporte({ deporte }: { deporte: Deporte }) {
  if (deporte === 'nadar') return <MunecoNadar />;
  if (deporte === 'bici') return <MunecoBici />;
  return <MunecoTrotar />;
}

/**
 * Overlay de progreso al guardar el CSV: porcentaje + muñequito
 * ciclando entre nadar, bici y trotar.
 */
export default function GuardadoCsvProgreso({
  open,
  pct,
  actual,
  total,
  etapa,
}: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) {
      setIdx(0);
      return;
    }
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % DEPORTES.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [open]);

  if (!open) return null;

  const deporte = DEPORTES[idx]!;
  const pctSafe = Math.min(100, Math.max(0, Math.round(pct)));

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <style>{STYLES}</style>

      <div className="mx-4 w-full max-w-sm rounded-2xl border border-indigo-400/30 bg-[#1a1a22] px-5 py-6 shadow-2xl">
        <div className="flex flex-col items-center gap-2">
          <MunecoDeporte deporte={deporte.id} />
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-300">
            {deporte.etiqueta}
          </p>
        </div>

        <p className="mt-4 text-center text-3xl font-black tabular-nums text-white">
          {pctSafe}%
        </p>
        <p className="mt-1 text-center text-sm font-semibold text-zinc-300">
          {etapa?.trim() || 'Guardando en contabilidad…'}
        </p>
        <p className="mt-0.5 text-center text-[11px] text-zinc-500">
          {total > 0 ? `${actual} de ${total} facturas` : 'Preparando…'}
        </p>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-300 transition-[width] duration-300 ease-out"
            style={{ width: `${pctSafe}%` }}
          />
        </div>
      </div>
    </div>
  );
}
