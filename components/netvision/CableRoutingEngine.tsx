'use client'

import { Mono } from '@/components/nexus/Mono'
import type { CableRoute } from '@/lib/netvision/types'
import { totalCableMeters } from '@/lib/netvision/services/cableRoutingEngine'

type Props = {
  routes: CableRoute[]
  onSelect?: (fromId: string, toId: string) => void
}

export default function CableRoutingEngine({ routes, onSelect }: Props) {
  const totalM = totalCableMeters(routes)

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          Rutas de cable
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Ortogonal + 15% holgura · TIA/EIA 568B · <Mono>{totalM} m</Mono> total
        </p>
      </div>

      {routes.length === 0 ? (
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Coloca cámaras y un switch/NVR PoE para generar rutas.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-auto text-[11px]">
          {routes.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect?.(r.fromId, r.toId)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left ${
                  r.warn
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <span className="font-semibold text-white">
                  {r.fromLabel} → {r.toLabel}
                </span>
                <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                  <Mono>
                    {r.routeM} m
                  </Mono>{' '}
                  ({r.straightM} m recto) · {r.type}
                  {r.warning ? ` · ${r.warning}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
