'use client'

import { Mono } from '@/components/nexus/Mono'
import {
  DRAWABLE_CABLE_TYPES,
  cableTypeLabel,
} from '@/lib/netvision/services/cableCalculator'
import { MANUAL_CABLE_TO_ID } from '@/lib/netvision/services/cableRoutingEngine'
import type { CableRoute, CableType, DesignCableSegment } from '@/lib/netvision/types'
import { totalCableMeters } from '@/lib/netvision/services/cableRoutingEngine'

type Props = {
  routes: CableRoute[]
  selectedRouteId?: string | null
  onSelectRoute?: (routeId: string) => void
  onAddBreak?: (routeId: string) => void
  onResetRoute?: (routeId: string) => void
  onRemoveBreak?: (routeId: string) => void
  manualSegments: DesignCableSegment[]
  drawType: CableType
  drawMode: boolean
  draftPoint: { x: number; y: number } | null
  disabled?: boolean
  onDrawType: (t: CableType) => void
  onDrawMode: (active: boolean) => void
  onSelect?: (id: string) => void
  onRemoveSegment: (id: string) => void
  onChangeSegmentType: (id: string, type: CableType) => void
}

export default function CableRoutingEngine({
  routes,
  selectedRouteId = null,
  onSelectRoute,
  onAddBreak,
  onResetRoute,
  onRemoveBreak,
  manualSegments,
  drawType,
  drawMode,
  draftPoint,
  disabled = false,
  onDrawType,
  onDrawMode,
  onSelect,
  onRemoveSegment,
  onChangeSegmentType,
}: Props) {
  const totalM = totalCableMeters(routes)
  const manualIds = new Set(manualSegments.map((s) => s.id))
  const selected = routes.find((r) => r.id === selectedRouteId) ?? null
  const selectedIsAuto =
    !!selected &&
    !manualIds.has(selected.id) &&
    selected.toId !== MANUAL_CABLE_TO_ID
  const breakCount = selectedIsAuto
    ? Math.max(0, selected!.points.length - 2)
    : 0

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          Rutas de cable
        </h2>
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Dibuja en el plano (2 toques) o rutas auto cámara→PoE con quiebres ·{' '}
          <Mono>{totalM} m</Mono> total
        </p>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase text-[var(--nexus-text-dim)]">
          Tipo a dibujar
        </p>
        <div className="flex flex-wrap gap-1">
          {DRAWABLE_CABLE_TYPES.map((t) => {
            const active = drawType === t
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onDrawType(t)
                  if (!drawMode) onDrawMode(true)
                }}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold disabled:opacity-40 ${
                  active
                    ? 'bg-yellow-400 text-black'
                    : 'border border-white/15 text-[var(--nexus-text-muted)]'
                }`}
              >
                {cableTypeLabel(t)}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onDrawMode(!drawMode)}
        className={`w-full rounded-lg px-2 py-1.5 text-[11px] font-semibold disabled:opacity-40 ${
          drawMode
            ? 'bg-yellow-400 text-black'
            : 'border border-yellow-400/40 text-yellow-200'
        }`}
      >
        {drawMode
          ? `Dibujando ${cableTypeLabel(drawType)}… (tocar plano)`
          : `+ Dibujar ${cableTypeLabel(drawType)} en plano`}
      </button>

      {drawMode ? (
        <p className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2 py-1.5 text-[11px] text-yellow-100">
          {draftPoint
            ? 'Toca el segundo punto en el plano para cerrar el cable.'
            : `Toca el inicio del cable (${cableTypeLabel(drawType)}).`}
        </p>
      ) : null}

      {selectedIsAuto ? (
        <div className="space-y-1.5 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2 py-2 text-[11px]">
          <p className="font-semibold text-yellow-100">
            {selected!.fromLabel} → {selected!.toLabel}
          </p>
          <p className="text-[var(--nexus-text-dim)]">
            <Mono>{selected!.routeM} m</Mono> · {breakCount} quiebre(s) · toca la
            línea o arrastra los puntos amarillos
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              className="rounded-md bg-yellow-400 px-2 py-1 text-[10px] font-semibold text-black"
              onClick={() => onAddBreak?.(selected!.id)}
            >
              + Añadir quiebre
            </button>
            {breakCount > 0 ? (
              <button
                type="button"
                className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-[var(--nexus-text-muted)]"
                onClick={() => onRemoveBreak?.(selected!.id)}
              >
                Quitar último
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-white/20 px-2 py-1 text-[10px] text-[var(--nexus-text-muted)]"
              onClick={() => onResetRoute?.(selected!.id)}
            >
              Restablecer L
            </button>
          </div>
        </div>
      ) : !drawMode ? (
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          Selecciona una ruta auto en la lista o en el plano para añadir quiebres.
        </p>
      ) : null}

      {manualSegments.length > 0 ? (
        <div>
          <h3 className="mb-1 text-[10px] font-bold uppercase text-[var(--nexus-text-dim)]">
            Dibujados ({manualSegments.length})
          </h3>
          <ul className="max-h-32 space-y-1 overflow-auto text-[11px]">
            {manualSegments.map((s) => {
              const run = routes.find((r) => r.id === s.id)
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1.5 rounded border border-yellow-400/25 bg-yellow-400/5 px-2 py-1"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect?.(s.id)}
                  >
                    <span className="font-semibold text-white">{s.label}</span>
                    <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                      {run ? (
                        <>
                          <Mono>{run.routeM} m</Mono> · {cableTypeLabel(s.type)}
                        </>
                      ) : (
                        cableTypeLabel(s.type)
                      )}
                    </span>
                  </button>
                  <select
                    value={s.type}
                    aria-label={`Tipo ${s.label}`}
                    onChange={(e) =>
                      onChangeSegmentType(s.id, e.target.value as CableType)
                    }
                    className="max-w-[5.5rem] rounded border border-white/15 bg-black/50 px-1 py-0.5 text-[10px] text-white"
                  >
                    {DRAWABLE_CABLE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {cableTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-[10px] text-red-300"
                    onClick={() => onRemoveSegment(s.id)}
                  >
                    Quitar
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {routes.length === 0 ? (
        <p className="text-[11px] text-[var(--nexus-text-dim)]">
          Dibuja un cable en el plano o coloca cámaras y un switch/NVR PoE.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-auto text-[11px]">
          {routes.map((r) => {
            const isManual = manualIds.has(r.id) || r.toId === MANUAL_CABLE_TO_ID
            const nBreaks = Math.max(0, r.points.length - 2)
            const active = r.id === selectedRouteId
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (isManual) onSelect?.(r.id)
                    else onSelectRoute?.(r.id)
                  }}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left ${
                    active
                      ? 'border-yellow-400/50 bg-yellow-400/15'
                      : r.warn
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-white/10 bg-black/20'
                  }`}
                >
                  <span className="font-semibold text-white">
                    {isManual
                      ? `${r.fromLabel} · ${r.toLabel}`
                      : `${r.fromLabel} → ${r.toLabel}`}
                  </span>
                  <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                    <Mono>{r.routeM} m</Mono>
                    {!isManual ? ` (${r.straightM} m recto)` : ''} ·{' '}
                    {cableTypeLabel(r.type)}
                    {isManual ? ' · dibujado' : ''}
                    {!isManual && nBreaks > 0 ? ` · ${nBreaks} quiebre(s)` : ''}
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
