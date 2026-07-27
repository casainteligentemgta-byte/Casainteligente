'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import {
  CAMERA_BRANDS,
  cameraCatalogGrouped,
  catalogVisionDefaults,
  getCameraModelOrDefault,
} from '@/lib/netvision/catalog/cameras'
import {
  STRUCTURE_MATERIALS,
  getStructureMaterialOrDefault,
} from '@/lib/netvision/catalog/materials'
import {
  defaultModelIdForKind,
  getNetworkModelOrDefault,
  labelPrefixForKind,
  networkCatalogByKind,
} from '@/lib/netvision/catalog/network'
import {
  DRAWABLE_CABLE_TYPES,
  cableTypeLabel,
} from '@/lib/netvision/services/cableCalculator'
import type {
  CableType,
  DesignCableSegment,
  DesignCamera,
  DesignNetworkNode,
  DesignStructure,
  NetworkNodeKind,
  StructureMaterialId,
} from '@/lib/netvision/types'
import {
  defaultNetworkPlanSize,
  networkPlanSizePct,
  NETWORK_PLAN_SIZE_MAX,
  NETWORK_PLAN_SIZE_MIN,
  planSizeNormFromPct,
  resolveNetworkPlanSize,
} from '@/lib/netvision/utils/networkNodeSize'

const NETWORK_KINDS: { kind: NetworkNodeKind; label: string }[] = [
  { kind: 'switch', label: 'Switch' },
  { kind: 'ap', label: 'AP WiFi' },
  { kind: 'nvr', label: 'NVR' },
  { kind: 'injector', label: 'Inyector' },
]

const fieldClass =
  'mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white'

type Props = {
  camera: DesignCamera | null
  network: DesignNetworkNode | null
  structure: DesignStructure | null
  cable: DesignCableSegment | null
  nightMode?: boolean
  onPatchCamera: (patch: Partial<DesignCamera>) => void
  onPatchNetwork: (patch: Partial<DesignNetworkNode>) => void
  onPatchStructure: (patch: Partial<DesignStructure>) => void
  onPatchCableType: (type: CableType) => void
  onRemove: (id: string) => void
}

/**
 * Editor de categoría del elemento seleccionado en el plano:
 * material de muro, tipo/modelo de red, modelo de cámara, tipo de cable.
 */
export default function NetVisionSelectedProps({
  camera,
  network,
  structure,
  cable,
  nightMode = false,
  onPatchCamera,
  onPatchNetwork,
  onPatchStructure,
  onPatchCableType,
  onRemove,
}: Props) {
  if (camera) {
    return (
      <div className="space-y-2 rounded-lg border border-[rgba(0,242,254,0.28)] bg-[rgba(0,242,254,0.06)] p-2.5 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
          Seleccionado · Cámara
        </p>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
          <input
            value={camera.label}
            onChange={(e) => onPatchCamera({ label: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Modelo</span>
          <select
            value={camera.modelId}
            onChange={(e) => {
              const id = e.target.value
              const vision = catalogVisionDefaults(id, nightMode ? 'night' : 'day')
              onPatchCamera({ modelId: id, ...vision })
            }}
            className={fieldClass}
          >
            {cameraCatalogGrouped().map((g) => (
              <optgroup key={g.brand} label={g.brand}>
                {g.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          {getCameraModelOrDefault(camera.modelId).brand} · {CAMERA_BRANDS.length} marcas
        </p>
        <Button
          type="button"
          variant="glass"
          className="w-full"
          onClick={() => onRemove(camera.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Quitar cámara
        </Button>
      </div>
    )
  }

  if (network) {
    const sizePct = networkPlanSizePct(resolveNetworkPlanSize(network))
    return (
      <div className="space-y-2 rounded-lg border border-[rgba(0,242,254,0.28)] bg-[rgba(0,242,254,0.06)] p-2.5 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
          Seleccionado · Equipo de red
        </p>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
          <input
            value={network.label}
            onChange={(e) => onPatchNetwork({ label: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Categoría</span>
          <select
            value={network.kind}
            onChange={(e) => {
              const kind = e.target.value as NetworkNodeKind
              const modelId = defaultModelIdForKind(kind)
              onPatchNetwork({
                kind,
                modelId,
                planSizeNorm: defaultNetworkPlanSize(kind),
                wifiChannel: kind === 'ap' ? network.wifiChannel ?? 36 : undefined,
                label: network.label.startsWith(labelPrefixForKind(network.kind))
                  ? `${labelPrefixForKind(kind)}${network.label.slice(
                      labelPrefixForKind(network.kind).length,
                    )}`
                  : network.label,
              })
            }}
            className={fieldClass}
          >
            {NETWORK_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Modelo</span>
          <select
            value={network.modelId}
            onChange={(e) => onPatchNetwork({ modelId: e.target.value })}
            className={fieldClass}
          >
            {networkCatalogByKind(network.kind).map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} · {m.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          {(() => {
            const m = getNetworkModelOrDefault(network.modelId, network.kind)
            return `${m.poeBudgetW} W PoE · ${m.poePorts} puertos · $${m.priceUsd}`
          })()}
        </p>
        <label className="block">
          <span className="flex items-center justify-between text-[var(--nexus-text-dim)]">
            <span>Tamaño en plano</span>
            <span className="tabular-nums text-white">{sizePct}% del ancho</span>
          </span>
          <input
            type="range"
            min={networkPlanSizePct(NETWORK_PLAN_SIZE_MIN)}
            max={networkPlanSizePct(NETWORK_PLAN_SIZE_MAX)}
            step={0.1}
            value={sizePct}
            onChange={(e) =>
              onPatchNetwork({
                planSizeNorm: planSizeNormFromPct(Number(e.target.value)),
              })
            }
            className="mt-1 w-full accent-[var(--nexus-cyan)]"
          />
        </label>
        <Button
          type="button"
          variant="glass"
          className="w-full"
          onClick={() => onRemove(network.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Quitar nodo
        </Button>
      </div>
    )
  }

  if (structure) {
    const mat = getStructureMaterialOrDefault(structure.materialId)
    return (
      <div className="space-y-2 rounded-lg border border-[rgba(0,242,254,0.28)] bg-[rgba(0,242,254,0.06)] p-2.5 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
          Seleccionado · Estructura
        </p>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
          <input
            value={structure.label}
            onChange={(e) => onPatchStructure({ label: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Material</span>
          <select
            value={structure.materialId}
            onChange={(e) =>
              onPatchStructure({
                materialId: e.target.value as StructureMaterialId,
              })
            }
            className={fieldClass}
          >
            {STRUCTURE_MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[10px]" style={{ color: mat.color }}>
          {mat.blocksVision
            ? `Corta visión · WiFi −${mat.wifiLossDb} dB · Sonido −${mat.soundLossDb} dB`
            : `Transparente · WiFi −${mat.wifiLossDb} dB · Sonido −${mat.soundLossDb} dB`}
        </p>
        <Button
          type="button"
          variant="glass"
          className="w-full"
          onClick={() => onRemove(structure.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Quitar estructura
        </Button>
      </div>
    )
  }

  if (cable) {
    return (
      <div className="space-y-2 rounded-lg border border-yellow-400/35 bg-yellow-400/10 p-2.5 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-100">
          Seleccionado · Cable
        </p>
        <p className="font-semibold text-white">{cable.label}</p>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Tipo de cable</span>
          <select
            value={cable.type}
            onChange={(e) => onPatchCableType(e.target.value as CableType)}
            className={fieldClass}
          >
            {DRAWABLE_CABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {cableTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="glass"
          className="w-full"
          onClick={() => onRemove(cable.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Quitar cable
        </Button>
      </div>
    )
  }

  return null
}
