'use client'

import { Trash2 } from 'lucide-react'
import { hasCustomLabelOffset } from '@/lib/netvision/utils/cameraLabelOffset'
import {
  CAM_MARKER_CHIPS,
  normalizeCamMarkerColor,
} from '@/lib/netvision/utils/cameraMarkerColor'
import { Button } from '@/components/nexus/ui/button'
import NetVisionAlcanceUtil from '@/components/netvision/NetVisionAlcanceUtil'
import NetVisionSplitterSymbol from '@/components/netvision/NetVisionSplitterSymbol'
import { alcanceUtilCamara } from '@/lib/netvision/services/dimensionamiento'
import {
  cameraCatalogGrouped,
  cameraCatalogOptionLabel,
  cameraVisionSummary,
  catalogVisionDefaults,
  conexionCamara,
  conexionesModelo,
  getCameraModelOrDefault,
  lenteElegida,
  opcionesLente,
  parcheLente,
  splitterDeCamara,
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
  DesignPlanDevice,
  DesignStructure,
  NetworkNodeKind,
  StructureMaterialId,
  UnitSystem,
} from '@/lib/netvision/types'
import {
  PLAN_DISCIPLINE_LABEL,
  PLAN_KIND_LABEL,
  getPlanDeviceModelOrDefault,
  planDevicesByDiscipline,
} from '@/lib/netvision/catalog/planDevices'
import {
  DEFAULT_MOUNT_HEIGHT_M,
  HEIGHT_PRESETS_M,
  MAX_MOUNT_HEIGHT_M,
  MAX_TILT_DEG,
  MIN_MOUNT_HEIGHT_M,
  MIN_TILT_DEG,
  TILT_PRESETS_DEG,
  clampMountHeightM,
  clampTiltDeg,
  projectGroundCoverage,
} from '@/lib/netvision/utils/cameraMount'
import { formatLength } from '@/lib/netvision/utils/units'
import { effectiveCameraVision } from '@/lib/netvision/catalog/cameras'
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
  planDevice?: DesignPlanDevice | null
  structure: DesignStructure | null
  cable: DesignCableSegment | null
  nightMode?: boolean
  unitSystem?: UnitSystem
  onPatchCamera: (patch: Partial<DesignCamera>) => void
  onPatchNetwork: (patch: Partial<DesignNetworkNode>) => void
  onPatchPlanDevice?: (patch: Partial<DesignPlanDevice>) => void
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
  planDevice = null,
  structure,
  cable,
  nightMode = false,
  unitSystem = 'metric',
  onPatchCamera,
  onPatchNetwork,
  onPatchPlanDevice,
  onPatchStructure,
  onPatchCableType,
  onRemove,
}: Props) {
  if (planDevice && onPatchPlanDevice) {
    const model = getPlanDeviceModelOrDefault(planDevice.modelId, planDevice.discipline)
    const rangeM = planDevice.rangeM ?? model.rangeM
    const fovDeg = planDevice.fovDeg ?? model.fovDeg
    return (
      <div className="space-y-2 rounded-lg border border-[rgba(0,242,254,0.28)] bg-[rgba(0,242,254,0.06)] p-2.5 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
          Seleccionado · {PLAN_DISCIPLINE_LABEL[planDevice.discipline]} ·{' '}
          {PLAN_KIND_LABEL[planDevice.kind]}
        </p>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Etiqueta</span>
          <input
            value={planDevice.label}
            onChange={(e) => onPatchPlanDevice({ label: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Modelo</span>
          <select
            value={planDevice.modelId}
            onChange={(e) => {
              const next = getPlanDeviceModelOrDefault(e.target.value, planDevice.discipline)
              onPatchPlanDevice({
                modelId: next.id,
                kind: next.kind,
                rangeM: undefined,
                fovDeg: undefined,
              })
            }}
            className={fieldClass}
          >
            {planDevicesByDiscipline(planDevice.discipline).map((m) => (
              <option key={m.id} value={m.id}>
                {PLAN_KIND_LABEL[m.kind]} · {m.brand} {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">
            Alcance {formatLength(rangeM, unitSystem)}
          </span>
          <input
            type="range"
            min={0.5}
            max={30}
            step={0.5}
            value={rangeM}
            onChange={(e) => onPatchPlanDevice({ rangeM: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
        {fovDeg < 359 ? (
          <label className="block">
            <span className="text-[var(--nexus-text-dim)]">Apertura {Math.round(fovDeg)}°</span>
            <input
              type="range"
              min={20}
              max={360}
              step={5}
              value={fovDeg}
              onChange={(e) => onPatchPlanDevice({ fovDeg: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
        ) : null}
        <p className="text-[10px] text-[var(--nexus-text-dim)]">
          {model.brand} · {model.name} · ficha {formatLength(model.rangeM, unitSystem)}
        </p>
        <Button
          type="button"
          variant="glass"
          className="w-full"
          onClick={() => onRemove(planDevice.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Quitar
        </Button>
      </div>
    )
  }

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
        {hasCustomLabelOffset(camera) ? (
          <button
            type="button"
            onClick={() =>
              onPatchCamera({ labelOffsetX: undefined, labelOffsetY: undefined })
            }
            className="text-[11px] font-semibold text-[var(--nexus-cyan)] hover:underline"
          >
            Volver a poner el nombre junto al pin
          </button>
        ) : (
          <p className="text-[10px] text-[var(--nexus-text-dim)]">
            En el plano puedes arrastrar el nombre para que no tape muros o cotas.
          </p>
        )}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
            Color en el plano
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CAM_MARKER_CHIPS.map((chip) => {
              const active = normalizeCamMarkerColor(camera.markerColor) === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  title={chip.label}
                  data-nv-marker={chip.id}
                  aria-pressed={active}
                  onClick={() => onPatchCamera({ markerColor: chip.id })}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ${
                    active ? 'ring-1 ring-white/80' : 'border border-white/15 bg-black/30 hover:bg-white/5'
                  }`}
                  style={{
                    color: chip.hex,
                    backgroundColor: active ? `${chip.hex}22` : undefined,
                    boxShadow: active ? `0 0 10px ${chip.hex}` : undefined,
                  }}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: chip.hex,
                      boxShadow: `0 0 7px ${chip.hex}`,
                    }}
                  />
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>
        <label className="block">
          <span className="text-[var(--nexus-text-dim)]">Modelo</span>
          <select
            value={camera.modelId}
            onChange={(e) => {
              const id = e.target.value
              const vision = catalogVisionDefaults(id, nightMode ? 'night' : 'day')
              // Otro modelo: vuelve a la conexión de ficha de ese modelo.
              onPatchCamera({ modelId: id, ...vision, conexion: undefined })
            }}
            className={fieldClass}
          >
            {cameraCatalogGrouped().map((g) => (
              <optgroup key={g.brand} label={g.brand}>
                {g.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {cameraCatalogOptionLabel(m)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {(() => {
          // Cómo llega la señal: por cable de red o por Wi‑Fi (si el modelo lo permite).
          const opciones = conexionesModelo(getCameraModelOrDefault(camera.modelId))
          const actual = conexionCamara(camera)
          const nombre = { cable: 'Cable de red', wifi: 'Wi‑Fi', bateria: 'Batería' } as const
          const elegibles = opciones.filter((o): o is 'cable' | 'wifi' => o !== 'bateria')
          const explica =
            actual === 'cable'
              ? 'Se calcula su cable, su puerto en el switch y su canal en el grabador.'
              : actual === 'wifi'
                ? 'Sin cable de red: solo necesita un enchufe cerca y buena señal Wi‑Fi. No ocupa puerto ni canal del grabador.'
                : 'Sin cables: funciona con batería y Wi‑Fi. No ocupa puerto ni canal del grabador.'
          return (
            <div data-nv-conexion={actual} className="space-y-1">
              <span className="text-[var(--nexus-text-dim)]">Conexión</span>
              {elegibles.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {elegibles.map((o) => (
                    <button
                      key={o}
                      type="button"
                      data-nv-conexion-opcion={o}
                      aria-pressed={actual === o}
                      className={`min-h-9 rounded-md px-2.5 text-[11px] font-semibold ${
                        actual === o
                          ? 'bg-[var(--nexus-cyan)] text-black'
                          : 'border border-white/15 text-[var(--nexus-cyan)]'
                      }`}
                      onClick={() =>
                        onPatchCamera({ conexion: o === opciones[0] ? undefined : o })
                      }
                    >
                      {nombre[o]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] font-semibold text-white">
                  {actual === 'bateria' ? 'Batería y Wi‑Fi' : `Solo ${nombre[actual].toLowerCase()}`}
                </p>
              )}
              <p className="text-[10px] leading-relaxed text-[var(--nexus-text-dim)]">{explica}</p>
              {(() => {
                const splitterV = splitterDeCamara(camera)
                if (splitterV) {
                  return (
                    <p
                      data-nv-splitter={splitterV}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300"
                    >
                      <NetVisionSplitterSymbol size={14} />
                      Adaptador PoE (splitter) de {splitterV} V
                    </p>
                  )
                }
                if (actual === 'cable') {
                  return (
                    <p data-nv-splitter="propio" className="text-[11px] text-[var(--nexus-text-dim)]">
                      Este modelo trae PoE propio: no lleva adaptador.
                    </p>
                  )
                }
                return null
              })()}
            </div>
          )
        })()}
        {(() => {
          // Modelos que se venden con varias lentes fijas: se elige la que se va a comprar.
          const model = getCameraModelOrDefault(camera.modelId)
          const opciones = opcionesLente(model)
          if (opciones.length === 0) return null
          const actual = lenteElegida(model, camera)
          return (
            <div data-nv-lente className="space-y-1">
              <span className="text-[var(--nexus-text-dim)]">Lente</span>
              <div className="flex flex-wrap gap-1">
                {opciones.map((o) => (
                  <button
                    key={o.focalMm}
                    type="button"
                    data-nv-lente-opcion={o.focalMm}
                    aria-pressed={actual?.focalMm === o.focalMm}
                    className={`min-h-9 rounded-md px-2.5 text-[11px] font-semibold ${
                      actual?.focalMm === o.focalMm
                        ? 'bg-[var(--nexus-cyan)] text-black'
                        : 'border border-white/15 text-[var(--nexus-cyan)]'
                    }`}
                    onClick={() => onPatchCamera(parcheLente(camera.modelId, o.focalMm))}
                  >
                    {o.focalMm} mm · {o.fovDeg}°
                  </button>
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--nexus-text-dim)]">
                Más milímetros = ángulo más cerrado y rostros identificables más lejos. Es otra
                referencia al comprar.
              </p>
            </div>
          )
        })()}
        {(() => {
          const model = getCameraModelOrDefault(camera.modelId)
          const vision = effectiveCameraVision(camera, nightMode ? 'night' : 'day')
          const heightM = camera.mountHeightM || DEFAULT_MOUNT_HEIGHT_M
          const tiltDeg = camera.tiltDeg ?? 0
          const ground = projectGroundCoverage({
            heightM,
            tiltDeg,
            hFovDeg: vision.fovDeg,
            rangeM: vision.rangeM,
          })
          return (
            <>
              <div className="space-y-1 text-[10px] leading-relaxed text-[var(--nexus-text-dim)]">
                <p>
                  {model.brand} · {cameraVisionSummary(model)}
                </p>
                {model.notes ? <p>{model.notes}</p> : null}
              </div>
              <NetVisionAlcanceUtil
                alcance={alcanceUtilCamara(camera)}
                unitSystem={unitSystem}
              />
              <div className="space-y-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-cyan)]">
                  Montaje
                </p>
                <label className="block">
                  <span className="text-[var(--nexus-text-dim)]">
                    Altura {formatLength(heightM, unitSystem)}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {HEIGHT_PRESETS_M.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
                          Math.abs(heightM - m) < 0.05
                            ? 'bg-[var(--nexus-cyan)] text-black'
                            : 'border border-white/15 text-[var(--nexus-cyan)]'
                        }`}
                        onClick={() => onPatchCamera({ mountHeightM: m })}
                      >
                        {formatLength(m, unitSystem, 1)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={MIN_MOUNT_HEIGHT_M}
                    max={MAX_MOUNT_HEIGHT_M}
                    step={0.1}
                    value={heightM}
                    onChange={(e) =>
                      onPatchCamera({ mountHeightM: clampMountHeightM(Number(e.target.value)) })
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--nexus-text-dim)]">
                    Inclinación {Math.round(tiltDeg)}°
                    {tiltDeg < 0.5 ? ' · horizonte' : tiltDeg >= 89 ? ' · al piso' : ' · hacia el piso'}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {TILT_PRESETS_DEG.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
                          Math.abs(tiltDeg - d) < 0.5
                            ? 'bg-[var(--nexus-cyan)] text-black'
                            : 'border border-white/15 text-[var(--nexus-cyan)]'
                        }`}
                        onClick={() => onPatchCamera({ tiltDeg: d })}
                      >
                        {d}°
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={MIN_TILT_DEG}
                    max={MAX_TILT_DEG}
                    step={1}
                    value={tiltDeg}
                    onChange={(e) =>
                      onPatchCamera({ tiltDeg: clampTiltDeg(Number(e.target.value)) })
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <p className="text-[10px] leading-relaxed text-[var(--nexus-text-muted)]">
                  {tiltDeg < 0.5 ? (
                    <>
                      Mira al horizonte: el cono llega{' '}
                      {formatLength(ground.farM, unitSystem)}. Inclina hacia el piso para
                      cubrir más cerca y recortar el fondo.
                    </>
                  ) : (
                    <>
                      En el piso: zona ciega {formatLength(ground.nearM, unitSystem)} ·
                      llega {formatLength(ground.farM, unitSystem)}.
                    </>
                  )}
                </p>
              </div>
            </>
          )
        })()}
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
        <label className="block">
          <span className="flex items-center justify-between text-[var(--nexus-text-dim)]">
            Grosor de esta línea
            <span className="tabular-nums text-[var(--nexus-cyan)]">
              {Math.round(structure.grosor ?? 50)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={structure.grosor ?? 50}
            onChange={(e) => onPatchStructure({ grosor: Number(e.target.value) })}
            className="mt-1 h-1.5 w-full accent-[var(--nexus-cyan)]"
            aria-label="Grosor de la línea seleccionada"
          />
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
