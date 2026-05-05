'use client';

import { useState } from 'react';
import type { CustomerScoreResult, CustomerLoyaltyTier } from '@/lib/finanzas/customerScore';

function tierClasses(tier: CustomerLoyaltyTier): string {
  switch (tier) {
    case 'Platinum':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40';
    case 'Gold':
      return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
    case 'Silver':
      return 'bg-zinc-500/20 text-zinc-200 border-zinc-400/35';
    default:
      return 'bg-orange-500/20 text-orange-300 border-orange-400/40';
  }
}

type Props = {
  model: CustomerScoreResult;
};

export default function CustomerLoyaltyCard({ model }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-4 text-left transition hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Score de fidelidad</p>
          <p className="mt-1 text-3xl font-black text-white">{model.score}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tierClasses(model.tier)}`}>{model.tier}</span>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs text-zinc-400">LTV Total</p>
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-100">
          ${model.breakdown.ltvTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <p className="text-zinc-500">Volumen</p>
          <p className="font-mono tabular-nums text-zinc-200">{model.breakdown.scoreVolumen.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <p className="text-zinc-500">Recurrencia</p>
          <p className="font-mono tabular-nums text-zinc-200">{model.breakdown.scoreRecurrencia.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <p className="text-zinc-500">Lealtad</p>
          <p className="font-mono tabular-nums text-zinc-200">{model.breakdown.scoreLealtad.toFixed(1)}</p>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-300">
          <p>Presupuestos aprobados: {model.breakdown.presupuestosAprobadosContribuyentes}</p>
          <p>Proyectos vinculados: {model.breakdown.proyectosContribuyentes}</p>
          <p>Ventas vinculadas: {model.breakdown.ventasContribuyentes}</p>
          <p>Recurrencia (12m): {model.breakdown.recurrencia12m}</p>
          <p>Antigüedad: {model.breakdown.antiguedadMeses.toFixed(1)} meses</p>
        </div>
      ) : null}
    </button>
  );
}
