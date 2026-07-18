'use client'

import { Button } from '@/components/nexus/ui/button'
import { Mono } from '@/components/nexus/Mono'
import {
  DEFAULT_AP_ID,
  DEFAULT_INJECTOR_ID,
  DEFAULT_NVR_ID,
  DEFAULT_SWITCH_ID,
  networkCatalogByKind,
} from '@/lib/netvision/catalog/network'
import { channelBandLabel } from '@/lib/netvision/services/channelOptimizer'
import type { CameraLinkAdvice, PoeBudgetRow } from '@/lib/netvision/services/poeAnalyzer'
import type { DesignNetworkNode, NetworkNodeKind } from '@/lib/netvision/types'

type Props = {
  nodes: DesignNetworkNode[]
  defaultModels: Record<NetworkNodeKind, string>
  poeRows: PoeBudgetRow[]
  linkAdvice: CameraLinkAdvice[]
  disabled?: boolean
  onAddKind: (kind: NetworkNodeKind) => void
  onDefaultModel: (kind: NetworkNodeKind, modelId: string) => void
  onOptimizeChannels: () => void
  onAutoAssignPoe: () => void
  onSelectNode: (id: string) => void
  onRemoveNode: (id: string) => void
}

const KINDS: { kind: NetworkNodeKind; label: string; defaultId: string }[] = [
  { kind: 'switch', label: 'Switch', defaultId: DEFAULT_SWITCH_ID },
  { kind: 'ap', label: 'AP WiFi', defaultId: DEFAULT_AP_ID },
  { kind: 'nvr', label: 'NVR', defaultId: DEFAULT_NVR_ID },
  { kind: 'injector', label: 'Injector', defaultId: DEFAULT_INJECTOR_ID },
]

export default function NetworkDesigner({
  nodes,
  defaultModels,
  poeRows,
  linkAdvice,
  disabled = false,
  onAddKind,
  onDefaultModel,
  onOptimizeChannels,
  onAutoAssignPoe,
  onSelectNode,
  onRemoveNode,
}: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
        Red · PoE / WiFi
      </h2>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            disabled={disabled}
            onClick={() => onAddKind(k.kind)}
            className="rounded-lg bg-[var(--nexus-cyan)] px-2 py-1 text-[11px] font-semibold text-black disabled:opacity-40"
          >
            + {k.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[var(--nexus-text-dim)]">
        Cada botón agrega un equipo al plano; arrástralo para ubicarlo.
      </p>

      <div className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase text-[var(--nexus-text-dim)]">
          Modelo al agregar
        </h3>
        {KINDS.map((k) => (
          <label key={k.kind} className="block text-[11px] text-[var(--nexus-text-dim)]">
            {k.label}
            <select
              value={defaultModels[k.kind]}
              onChange={(e) => onDefaultModel(k.kind, e.target.value)}
              className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            >
              {networkCatalogByKind(k.kind).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brand} · {m.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="glass" className="text-[11px]" onClick={onAutoAssignPoe}>
          Auto-asignar PoE
        </Button>
        <Button type="button" variant="glass" className="text-[11px]" onClick={onOptimizeChannels}>
          Optimizar canales
        </Button>
      </div>

      <div>
        <h3 className="mb-1 text-[10px] font-bold uppercase text-[var(--nexus-text-dim)]">
          Presupuesto PoE
        </h3>
        {poeRows.length === 0 ? (
          <p className="text-[11px] text-[var(--nexus-text-dim)]">Sin nodos PoE.</p>
        ) : (
          <ul className="space-y-1 text-[11px]">
            {poeRows.map((r) => (
              <li
                key={r.nodeId}
                className={`rounded border px-2 py-1 ${
                  r.ok
                    ? 'border-white/10 bg-black/20'
                    : 'border-red-500/40 bg-red-500/10 text-red-200'
                }`}
              >
                <button type="button" className="w-full text-left" onClick={() => onSelectNode(r.nodeId)}>
                  <span className="font-semibold text-white">{r.label}</span>
                  <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                    <Mono>
                      {r.usedW.toFixed(1)}/{r.budgetW} W · {r.usedPorts}/{r.ports} puertos
                    </Mono>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-[10px] font-bold uppercase text-[var(--nexus-text-dim)]">
          Enlaces cámara → PoE
        </h3>
        {linkAdvice.length === 0 ? (
          <p className="text-[11px] text-[var(--nexus-text-dim)]">Sin cámaras.</p>
        ) : (
          <ul className="max-h-36 space-y-1 overflow-auto text-[11px]">
            {linkAdvice.map((a) => (
              <li
                key={a.cameraId}
                className={`rounded border px-2 py-1 ${
                  a.needsInjector
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <span className="font-semibold text-white">{a.cameraLabel}</span>
                <span className="mt-0.5 block text-[var(--nexus-text-dim)]">
                  {a.nearestLabel ?? 'sin nodo'} · <Mono>{a.distanceM} m</Mono> · {a.cableType}
                  {a.needsInjector ? ' · injector/fibra' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-[10px] font-bold uppercase text-[var(--nexus-text-dim)]">
          Nodos ({nodes.length})
        </h3>
        {nodes.length === 0 ? (
          <p className="text-[11px] text-[var(--nexus-text-dim)]">
            Usa + Switch / AP / NVR / Injector para agregarlos al plano.
          </p>
        ) : (
          <ul className="max-h-32 space-y-1 overflow-auto text-[11px]">
            {nodes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/20 px-2 py-1"
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectNode(n.id)}>
                  <span className="font-semibold text-white">{n.label}</span>
                  <span className="mt-0.5 block truncate text-[var(--nexus-text-dim)]">
                    {n.kind}
                    {n.kind === 'ap' ? ` · ${channelBandLabel(n.wifiChannel)}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className="text-[10px] text-red-300"
                  onClick={() => onRemoveNode(n.id)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
