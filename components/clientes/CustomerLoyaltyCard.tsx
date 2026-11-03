'use client';

import { useState } from 'react';
import type { CustomerScoreResult, CustomerLoyaltyTier } from '@/lib/finanzas/customerScore';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

function tierColor(tier: CustomerLoyaltyTier): { bg: string; text: string; border: string } {
  switch (tier) {
    case 'Platinum':
      return { bg: 'rgba(6,182,212,0.18)', text: '#67e8f9', border: 'rgba(34,211,238,0.4)' };
    case 'Gold':
      return { bg: 'rgba(245,158,11,0.18)', text: 'var(--tono-naranja)', border: 'rgba(245,158,11,0.4)' };
    case 'Silver':
      return { bg: tinta(0.08), text: 'var(--label-primary)', border: tinta(0.2) };
    default:
      return { bg: 'rgba(249,115,22,0.18)', text: 'var(--tono-naranja)', border: 'rgba(249,115,22,0.4)' };
  }
}

export default function CustomerLoyaltyCard({ model }: { model: CustomerScoreResult }) {
  const [open, setOpen] = useState(false);
  const t = tierColor(model.tier);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-2xl p-4 text-left transition"
      style={{
        border: `1px solid ${tinta(0.1)}`,
        background: 'var(--superficie)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: tintaTexto(0.45) }}>
            Score de fidelidad
          </p>
          <p className="mt-1 text-3xl font-black" style={{ color: 'var(--label-primary)' }}>
            {model.score}
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-xs font-bold"
          style={{ background: t.bg, color: t.text, borderColor: t.border }}
        >
          {model.tier}
        </span>
      </div>

      <div className="mt-4 rounded-xl p-3" style={{ border: `1px solid ${tinta(0.1)}`, background: tinta(0.03) }}>
        <p className="text-xs" style={{ color: tintaTexto(0.45) }}>
          LTV Total
        </p>
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums" style={{ color: 'var(--label-primary)' }}>
          ${model.breakdown.ltvTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {[
          ['Volumen', model.breakdown.scoreVolumen],
          ['Recurrencia', model.breakdown.scoreRecurrencia],
          ['Lealtad', model.breakdown.scoreLealtad],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-lg p-2" style={{ border: `1px solid ${tinta(0.1)}` }}>
            <p style={{ color: tintaTexto(0.45) }}>{label}</p>
            <p className="font-mono tabular-nums" style={{ color: 'var(--label-primary)' }}>
              {Number(val).toFixed(1)}
            </p>
          </div>
        ))}
      </div>

      {open ? (
        <div
          className="mt-3 space-y-1 rounded-xl p-3 text-xs"
          style={{ border: `1px solid ${tinta(0.1)}`, background: tinta(0.04), color: 'var(--label-secondary)' }}
        >
          <p>Presupuestos aceptados: {model.breakdown.presupuestosAprobadosContribuyentes}</p>
          <p>Proyectos vinculados: {model.breakdown.proyectosContribuyentes}</p>
          <p>Ventas vinculadas: {model.breakdown.ventasContribuyentes}</p>
          <p>Recurrencia (12m): {model.breakdown.recurrencia12m}</p>
          <p>Antigüedad: {model.breakdown.antiguedadMeses.toFixed(1)} meses</p>
        </div>
      ) : null}
    </button>
  );
}
