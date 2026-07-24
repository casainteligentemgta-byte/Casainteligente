'use client'

import { Mono } from '@/components/nexus/Mono'
import type { ConduitPlan } from '@/lib/netvision/services/conduitCalculator'
import conduits from '@/data/netvision/conduits.json'

type Props = {
  plans: ConduitPlan[]
  onSelectNode?: (id: string) => void
}

export default function ConduitCalculator({ plans, onSelectNode }: Props) {
  const maxPct = Math.round(conduits.maxOccupancy * 100)

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          Cajetines / conductos
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Ocupación máx {maxPct}% · selector automático por nº de Cat6
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-[11px] text-[var(--nexus-text-dim)]">Sin agrupaciones aún.</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-auto text-[11px]">
          {plans.map((p) => (
            <li key={p.nodeId}>
              <button
                type="button"
                onClick={() => onSelectNode?.(p.nodeId)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left ${
                  p.ok
                    ? 'border-white/10 bg-black/20'
                    : 'border-red-500/40 bg-red-500/10 text-red-200'
                }`}
              >
                <span className="font-semibold text-white">{p.nodeLabel}</span>
                <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                  {p.cableCount} cables → {p.box.label} ·{' '}
                  <Mono>{Math.round(p.occupancy * 100)}%</Mono> cap.
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px] text-[var(--nexus-text-dim)]">
        <p className="font-semibold text-[var(--nexus-text-muted)]">Referencia</p>
        <ul className="mt-1 space-y-0.5">
          {(conduits.boxes as { label: string; maxCat6: number }[]).map((b) => (
            <li key={b.label}>
              {b.label}: hasta {b.maxCat6} Cat6
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
