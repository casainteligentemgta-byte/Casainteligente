'use client'

import { useMemo, useState } from 'react'
import type {
  DesignInfraDevice,
  DesignNetworkNode,
  InfraKind,
  RackSizeU,
} from '@/lib/netvision/types'
import { nvrCatalog } from '@/lib/netvision/catalog/network'
import {
  HDD_CAPACITIES_TB,
  INFRA_KIND_LABEL,
  RACK_SIZES_U,
  canPlaceInRack,
  clampHddTb,
  clampRackSizeU,
  firstFreeU,
  getInfraModelOrDefault,
  infraCatalogByKind,
  listMountables,
  mountIntoRack,
  occupancy,
  rackTotalU,
  resizeRack,
  unmountFromRacks,
  usedU,
} from '@/lib/netvision/catalog/salaTecnica'

type Props = {
  networkNodes: DesignNetworkNode[]
  infraDevices: DesignInfraDevice[]
  defaultNvrId: string
  defaultDvrId: string
  defaultInfra: Record<InfraKind, string>
  defaultHddTb: number
  defaultRackU: RackSizeU
  disabled?: boolean
  onDefaultNvr: (id: string) => void
  onDefaultDvr: (id: string) => void
  onDefaultInfra: (kind: InfraKind, id: string) => void
  onDefaultHddTb: (tb: number) => void
  onDefaultRackU: (u: RackSizeU) => void
  onAddRecorder: (recorder: 'nvr' | 'dvr') => void
  onAddInfra: (kind: InfraKind) => void
  onPatchInfra: (id: string, patch: Partial<DesignInfraDevice>) => void
  onSelect: (id: string) => void
}

export default function NetVisionSalaTecnica({
  networkNodes,
  infraDevices,
  defaultNvrId,
  defaultDvrId,
  defaultInfra,
  defaultHddTb,
  defaultRackU,
  disabled,
  onDefaultNvr,
  onDefaultDvr,
  onDefaultInfra,
  onDefaultHddTb,
  onDefaultRackU,
  onAddRecorder,
  onAddInfra,
  onPatchInfra,
  onSelect,
}: Props) {
  const racks = infraDevices.filter((d) => d.kind === 'rack')
  const [rackId, setRackId] = useState<string>(racks[0]?.id ?? '')
  const [holding, setHolding] = useState<string | null>(null)
  const items = useMemo(
    () => listMountables(networkNodes, infraDevices),
    [networkNodes, infraDevices],
  )
  const rack = racks.find((r) => r.id === rackId) ?? racks[0] ?? null
  const slots = rack ? occupancy(rack, items) : []
  const holdingItem = items.find((i) => i.id === holding) ?? null

  const place = (startU: number) => {
    if (!rack || !holdingItem) return
    if (!canPlaceInRack(rack, items, startU, holdingItem.heightU, holdingItem.id)) {
      return
    }
    const next = mountIntoRack(rack, holdingItem.id, holdingItem.source, startU)
    onPatchInfra(rack.id, { mounts: next.mounts, rackUnits: rackTotalU(rack) })
    if (holdingItem.source === 'infra') {
      onPatchInfra(holdingItem.id, { rackId: rack.id, rackStartU: startU })
    }
    setHolding(null)
  }

  const eject = (deviceId: string) => {
    if (!rack) return
    const next = unmountFromRacks([rack], deviceId)[0]
    if (!next) return
    onPatchInfra(rack.id, { mounts: next.mounts ?? [] })
    const item = items.find((i) => i.id === deviceId)
    if (item?.source === 'infra') {
      onPatchInfra(deviceId, { rackId: null, rackStartU: undefined })
    }
    if (holding === deviceId) setHolding(null)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
          Grabación
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            className="rounded-md bg-[var(--nexus-cyan)] px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-40"
            onClick={() => onAddRecorder('nvr')}
          >
            + NVR
          </button>
          <button
            type="button"
            disabled={disabled}
            className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
            onClick={() => onAddRecorder('dvr')}
          >
            + DVR
          </button>
        </div>
        <label className="mt-1.5 block text-[11px] text-[var(--nexus-text-dim)]">
          Modelo NVR
          <select
            value={defaultNvrId}
            onChange={(e) => onDefaultNvr(e.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          >
            {nvrCatalog('nvr').map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} · {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-1.5 block text-[11px] text-[var(--nexus-text-dim)]">
          Modelo DVR
          <select
            value={defaultDvrId}
            onChange={(e) => onDefaultDvr(e.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          >
            {nvrCatalog('dvr').map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} · {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
          Sala técnica
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(['monitor', 'hdd', 'ups', 'rack'] as InfraKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              onClick={() => onAddInfra(kind)}
            >
              + {INFRA_KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <label className="mt-1.5 block text-[11px] text-[var(--nexus-text-dim)]">
          Pantalla
          <select
            value={defaultInfra.monitor}
            onChange={(e) => onDefaultInfra('monitor', e.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          >
            {infraCatalogByKind('monitor').map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <label className="text-[11px] text-[var(--nexus-text-dim)]">
            Disco
            <select
              value={defaultInfra.hdd}
              onChange={(e) => onDefaultInfra('hdd', e.target.value)}
              className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            >
              {infraCatalogByKind('hdd').map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brand} {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-[var(--nexus-text-dim)]">
            Capacidad
            <select
              value={defaultHddTb}
              onChange={(e) => onDefaultHddTb(clampHddTb(Number(e.target.value)))}
              className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            >
              {HDD_CAPACITIES_TB.map((tb) => (
                <option key={tb} value={tb}>
                  {tb} TB
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-1.5 block text-[11px] text-[var(--nexus-text-dim)]">
          UPS
          <select
            value={defaultInfra.ups}
            onChange={(e) => onDefaultInfra('ups', e.target.value)}
            className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          >
            {infraCatalogByKind('ups').map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-1.5">
          <p className="text-[11px] text-[var(--nexus-text-dim)]">Tamaño del rack</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {RACK_SIZES_U.map((u) => (
              <button
                key={u}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onDefaultRackU(u)
                  onDefaultInfra('rack', `rack-${u}u`)
                  if (rack) {
                    const next = resizeRack(rack, u, items)
                    onPatchInfra(rack.id, {
                      rackUnits: next.rackUnits,
                      modelId: next.modelId,
                      mounts: next.mounts,
                    })
                  }
                }}
                className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
                  defaultRackU === u
                    ? 'bg-[var(--nexus-cyan)] text-black'
                    : 'border border-white/15 text-white'
                }`}
              >
                {u}U
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
          Armar rack
        </p>
        {racks.length === 0 ? (
          <p className="text-[11px] text-[var(--nexus-text-dim)]">
            Agrega un rack y luego toca un equipo y una unidad (U) para montarlo.
          </p>
        ) : (
          <>
            <select
              value={rack?.id ?? ''}
              onChange={(e) => setRackId(e.target.value)}
              className="mb-2 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            >
              {racks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} · {clampRackSizeU(r.rackUnits)}U
                </option>
              ))}
            </select>
            {rack ? (
              <p className="mb-1 text-[10px] text-[var(--nexus-text-dim)]">
                Ocupado {usedU(rack, items)}/{rackTotalU(rack)} U
                {holdingItem
                  ? ` · toca una U para ${holdingItem.label} (${holdingItem.heightU}U)`
                  : ''}
              </p>
            ) : null}
            {items.length === 0 ? (
              <p className="mb-2 text-[11px] text-[var(--nexus-text-dim)]">
                Agrega un NVR, DVR, switch, disco o UPS de rack para montarlos aquí.
              </p>
            ) : null}
            <div className="mb-2 flex flex-wrap gap-1">
              {items.map((it) => {
                const mounted = rack
                  ? occupancy(rack, items).some((s) => s.item?.id === it.id)
                  : false
                return (
                  <span key={it.id} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setHolding(holding === it.id ? null : it.id)}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                        holding === it.id
                          ? 'bg-[var(--nexus-cyan)] text-black'
                          : mounted
                            ? 'border border-emerald-400/40 text-emerald-200'
                            : 'border border-white/15 text-white'
                      }`}
                    >
                      {it.label}
                    </button>
                    {mounted ? (
                      <button
                        type="button"
                        title="Sacar del rack"
                        onClick={() => eject(it.id)}
                        className="rounded-md px-1.5 py-1 text-[10px] text-[var(--nexus-text-dim)] hover:text-white"
                      >
                        Sacar
                      </button>
                    ) : null}
                  </span>
                )
              })}
            </div>
            {rack ? (
              <ol className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/30">
                {slots.map((slot) => {
                  const start = slot.mount?.startU === slot.u
                  return (
                    <li key={slot.u}>
                      <button
                        type="button"
                        onClick={() => {
                          if (holdingItem) {
                            place(slot.u)
                            return
                          }
                          if (slot.item) onSelect(slot.item.id)
                        }}
                        className={`flex w-full items-center gap-2 border-b border-white/5 px-2 py-1 text-left text-[11px] ${
                          slot.item
                            ? 'bg-white/5 text-white'
                            : 'text-[var(--nexus-text-dim)]'
                        }`}
                      >
                        <span className="w-7 font-mono text-[10px] text-[var(--nexus-cyan)]">
                          {slot.u}U
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {start
                            ? `${slot.item?.label} · ${slot.item?.detail}`
                            : slot.item
                              ? ''
                              : 'libre'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
