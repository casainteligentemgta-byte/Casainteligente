'use client'

import { Mono } from '@/components/nexus/Mono'
import type { CableRoute } from '@/lib/netvision/types'
import { totalCableMeters } from '@/lib/netvision/services/cableRoutingEngine'

type Props = {
  routes: CableRoute[]
  selectedRouteId?: string | null
  onSelectRoute?: (routeId: string) => void
  onAddBreak?: (routeId: string) => void
  onResetRoute?: (routeId: string) => void
  onRemoveBreak?: (routeId: string) => void
}

export default function CableRoutingEngine({
  routes,
  selectedRouteId = null,
  onSelectRoute,
  onAddBreak,
  onResetRoute,
  onRemoveBreak,
}: Props) {
  const totalM = totalCableMeters(routes)
  const selected = routes.find((r) => r.id === selectedRouteId) ?? null
  const breakCount = selected ? Math.max(0, selected.points.length - 2) : 0

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          Rutas de cable
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Cámara→switch con quiebres · +15% holgura · <Mono>{totalM} m</Mono> total
        </p>
      </div>

      {selected ? (
        <div className="space-y-1.5 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2 py-2 text-[11px]">
          <p className="font-semibold text-yellow-100">
            {selected.fromLabel} → {selected.toLabel}
          </p>
          <p className="text-[var(--nexus-text-dim)]">
            <Mono>{selected.routeM} m</Mono> · {breakCount} quiebre(s) · toca la
            línea o arrastra los puntos amarillos
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              className="rounded-md bg-yellow-400 px-2 py-1 text-[10px] font-semibold text-black"
              onClick={() => onAddBreak?.(selected.id)}
            >
              + Añadir quiebre
            </button>
            {breakCount > 0 ? (
              <button
                type="button"
                className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-[var(--nexus-text-muted)]"
                onClick={() => onRemoveBreak?.(selected.id)}
              >
                Quitar último
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-[var(--nexus-text-muted)]"
              onClick={() => onResetRoute?.(selected.id)}
            >
              Restablecer L
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          Selecciona una ruta en la lista o en el plano para añadir quiebres.
        </p>
      )}

      {routes.length === 0 ? (
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Coloca cámaras y un switch/NVR PoE para generar rutas.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-auto text-[11px]">
          {routes.map((r) => {
            const nBreaks = Math.max(0, r.points.length - 2)
            const active = r.id === selectedRouteId
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelectRoute?.(r.id)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left ${
                    active
                      ? 'border-yellow-400/50 bg-yellow-400/15'
                      : r.warn
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-white/10 bg-black/20'
                  }`}
                >
                  <span className="font-semibold text-white">
                    {r.fromLabel} → {r.toLabel}
                  </span>
                  <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                    <Mono>{r.routeM} m</Mono> ({r.straightM} m recto) · {r.type}
                    {nBreaks > 0 ? ` · ${nBreaks} quiebre(s)` : ''}
                    {r.warning ? ` · ${r.warning}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
