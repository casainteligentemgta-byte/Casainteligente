'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Printer, ArrowLeft, Link2, Check } from 'lucide-react'
import CameraPlacementTool from '@/components/netvision/CameraPlacementTool'
import NetVisionCameraVisionToggles from '@/components/netvision/NetVisionCameraVisionToggles'
import { VISION_SEMAFORO_LEGEND } from '@/lib/netvision/utils/visionSemaforoPalette'
import {
  isolateHiddenCameraIds,
  pruneHiddenCameraIds,
  toggleHiddenCameraId,
} from '@/lib/netvision/utils/cameraVisionVisibility'
import { buildCoverageSectors } from '@/lib/netvision/services/coverageCalculator'
import {
  buildCableRoutes,
  withManualCableSegments,
} from '@/lib/netvision/services/cableRoutingEngine'
import { loadProject, peekLocalProject } from '@/lib/netvision/storage'
import type { DesignCamera, NetVisionProject } from '@/lib/netvision/types'
import {
  buildClienteCameraCard,
  totalClienteCableMeters,
  type ClienteCameraCard,
} from '@/lib/netvision/utils/clienteCameraCard'
import { formatLength } from '@/lib/netvision/utils/units'
import { normalizeCotaColor } from '@/lib/netvision/utils/nightPlanoPalette'
import { buildPlanoRotulo } from '@/lib/netvision/utils/planoRotulo'
import NetVisionPlanoRotulo from '@/components/netvision/NetVisionPlanoRotulo'

function loadClienteProject(id: string | null): NetVisionProject | null {
  if (id) {
    return peekLocalProject(id) ?? loadProject()
  }
  try {
    return loadProject()
  } catch {
    return null
  }
}

function CameraFicha({
  card,
  unitSystem,
  compact,
}: {
  card: ClienteCameraCard
  unitSystem: NetVisionProject['unitSystem']
  compact?: boolean
}) {
  return (
    <article
      data-nv-ficha={card.id}
      className="rounded-xl border border-white/12 bg-black/35 p-3"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
        {card.brand}
      </p>
      <h3 className="mt-0.5 text-sm font-bold text-white">{card.label}</h3>
      <p className="text-[12px] text-[var(--nexus-cyan)]">{card.modelName}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-white/80">
        <div>
          <dt className="text-[var(--nexus-text-dim)]">Forma</dt>
          <dd className="font-semibold text-white">{card.formLabel}</dd>
        </div>
        <div>
          <dt className="text-[var(--nexus-text-dim)]">Resolución</dt>
          <dd className="font-semibold text-white">{card.resolution}</dd>
        </div>
        <div>
          <dt className="text-[var(--nexus-text-dim)]">Ángulo</dt>
          <dd className="font-semibold text-white">{card.fovLabel}</dd>
        </div>
        <div>
          <dt className="text-[var(--nexus-text-dim)]">Alcance</dt>
          <dd className="font-semibold text-white">
            {card.rangeDayM} m día / {card.rangeNightM} m noche
          </dd>
        </div>
        {!compact ? (
          <>
            <div>
              <dt className="text-[var(--nexus-text-dim)]">Montaje</dt>
              <dd className="font-semibold text-white">
                {formatLength(card.mountHeightM, unitSystem)} · {card.tiltDeg}°
              </dd>
            </div>
            <div>
              <dt className="text-[var(--nexus-text-dim)]">Señal</dt>
              <dd className="font-semibold text-white">{card.bitrateMbps} Mbps</dd>
            </div>
          </>
        ) : null}
      </dl>
      {card.notes ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">{card.notes}</p>
      ) : null}
      <p className="mt-2 text-[11px] font-semibold text-emerald-300">
        {card.connectionLabel}
        {card.wired && card.poeWatts > 0 ? ` · ${card.poeWatts} W PoE` : ''}
      </p>
      {card.wired ? (
        card.cables.length > 0 ? (
          <ul className="mt-1.5 space-y-1 text-[12px] text-white/85">
            {card.cables.map((c) => (
              <li key={c.id}>
                {c.typeLabel} → {c.toLabel}:{' '}
                <span className="font-semibold text-white">
                  {formatLength(c.meters, unitSystem)}
                </span>
              </li>
            ))}
            <li className="pt-0.5 text-[11px] text-[var(--nexus-text-dim)]">
              Total tendido:{' '}
              <span className="font-semibold text-white">
                {formatLength(card.cableMeters, unitSystem)}
              </span>
            </li>
          </ul>
        ) : (
          <p className="mt-1 text-[11px] text-amber-200/90">
            Cableada, pero aún no hay ruta de tendido en el plano.
          </p>
        )
      ) : (
        <p className="mt-1 text-[11px] text-white/60">
          Sin metros de cable: no requiere tendido PoE.
        </p>
      )}
    </article>
  )
}

export default function NetVisionClienteView() {
  const search = useSearchParams()
  const [project, setProject] = useState<NetVisionProject | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const loaded = loadClienteProject(search.get('id'))
    setProject(loaded)
    const cam = search.get('cam')
    if (cam && loaded?.cameras.some((c) => c.id === cam)) {
      setSelectedId(cam)
      setHiddenIds(isolateHiddenCameraIds(loaded.cameras.map((c) => c.id), cam))
    } else {
      setSelectedId(null)
      setHiddenIds([])
    }
  }, [search])

  const cameras: DesignCamera[] = project?.cameras ?? []
  const cameraIds = useMemo(() => cameras.map((c) => c.id), [cameras])
  const hiddenLive = useMemo(
    () => pruneHiddenCameraIds(hiddenIds, cameraIds),
    [hiddenIds, cameraIds],
  )

  const sectors = useMemo(() => {
    if (!project) return []
    return buildCoverageSectors(project.cameras, project.scale, 'day', project.structures ?? [])
  }, [project])

  const cableRoutes = useMemo(() => {
    if (!project) return []
    return withManualCableSegments(
      buildCableRoutes(
        project.cameras,
        project.networkNodes,
        project.scale,
        project.cableRouteOverrides ?? {},
      ),
      project.cableSegments ?? [],
      project.scale,
    )
  }, [project])

  const cards = useMemo(
    () => cameras.map((cam) => buildClienteCameraCard(cam, cableRoutes)),
    [cameras, cableRoutes],
  )

  const selectedCard = cards.find((c) => c.id === selectedId) ?? null
  const visibleSectors = sectors.filter((s) => !hiddenLive.includes(s.cameraId))
  const allOn = hiddenLive.length === 0
  const cableTotal = totalClienteCableMeters(cards)

  const showAll = () => {
    setHiddenIds([])
    setSelectedId(null)
  }
  const showSolo = (id: string) => {
    setHiddenIds(isolateHiddenCameraIds(cameraIds, id))
    setSelectedId(id)
  }

  const copyLink = async () => {
    if (!project) return
    const url = new URL('/nexus/vision/cliente', window.location.origin)
    url.searchParams.set('id', project.id)
    if (selectedId) url.searchParams.set('cam', selectedId)
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-white/80">
        No hay un proyecto NetVision en este navegador.{' '}
        <Link href="/nexus/vision" className="font-semibold text-[var(--nexus-cyan)]">
          Abrir el editor
        </Link>
      </div>
    )
  }

  return (
    <div className="nv-cliente flex h-[calc(100dvh-7.25rem)] min-h-[28rem] flex-col gap-2 overflow-hidden print:h-auto print:min-h-0 print:overflow-visible">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
            Presentación cliente · NetVision
          </p>
          <h1 className="text-lg font-bold text-white">{project.name || 'Proyecto'}</h1>
          {project.client ? (
            <p className="text-[12px] text-white/70">Cliente: {project.client}</p>
          ) : null}
          <p className="mt-1 text-[12px] text-white/70">
            {cameras.length} cámara{cameras.length === 1 ? '' : 's'}
            {cableTotal > 0
              ? ` · ${formatLength(cableTotal, project.unitSystem)} de cable PoE`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link
            href="/nexus/vision"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-[12px] font-semibold text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Editor
          </Link>
          <button
            type="button"
            data-nv-copiar-enlace
            onClick={() => void copyLink()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-[12px] font-semibold text-white hover:bg-white/10"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-emerald-500 px-3 text-[12px] font-bold text-black hover:bg-emerald-400"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir / PDF
          </button>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/70 print:hidden">
        <span className="font-semibold uppercase tracking-wide text-white">Semáforo</span>
        {VISION_SEMAFORO_LEGEND.map((item) => (
          <span key={item.band} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.hex }} />
            {item.label}
          </span>
        ))}
      </div>

      {cameras.length > 0 ? (
        <div className="shrink-0 print:hidden">
          <NetVisionCameraVisionToggles
            cameras={cameras}
            hiddenIds={hiddenLive}
            readOnlyHint
            onShowAll={showAll}
            onSolo={showSolo}
            onToggle={(id) => setHiddenIds((prev) => toggleHiddenCameraId(prev, id))}
            onSelect={setSelectedId}
          />
        </div>
      ) : (
        <p className="text-[12px] text-white/60">Este proyecto aún no tiene cámaras.</p>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(200px,42dvh)_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:grid-rows-[minmax(0,1fr)]">
        <div className="min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#05080d] print:min-h-[360px]">
          {project.planoUrl ? (
            <NetVisionPlanoRotulo
              rotulo={buildPlanoRotulo({
                projectName: project.name,
                branch: 'cctv',
              })}
            >
            <CameraPlacementTool
              backgroundUrl={project.planoUrl}
              invertBackground={Boolean(project.planoInvertido)}
              invertOptions={{
                cotaColor: normalizeCotaColor(project.planoCotaColor),
                grosorMuro: project.planoGrosorMuro,
              }}
              wallStrokeGrosor={project.planoGrosorMuro}
              cameras={cameras}
              networkNodes={project.networkNodes}
              planDevices={project.planDevices}
              structures={project.structures}
              sectors={visibleSectors}
              wifiCircles={[]}
              linkLines={[]}
              cableRoutes={
                allOn
                  ? cableRoutes
                  : cableRoutes.filter(
                      (r) => !hiddenLive.includes(r.fromId) && !hiddenLive.includes(r.toId),
                    )
              }
              selectedId={selectedId}
              placeMode={false}
              showFov
              visionOpacity={0.36}
              coverageHiddenIds={hiddenLive}
              showWifi={false}
              showLinks={false}
              showCableRoutes
              showStructures
              readOnly
              onAddAt={() => undefined}
              onMove={() => undefined}
              metersPerNormX={project.scale.metersPerNormX}
              metersPerNormY={project.scale.metersPerNormY}
              onSelect={(id) => {
                if (!id) {
                  setSelectedId(null)
                  showAll()
                  return
                }
                if (cameras.some((c) => c.id === id)) showSolo(id)
              }}
              showZoomOverlay
            />
            </NetVisionPlanoRotulo>
          ) : (
            <p className="p-6 text-sm text-white/70">Este proyecto no tiene plano cargado.</p>
          )}
        </div>

        <aside className="flex min-h-0 flex-col">
          <p className="shrink-0 px-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nexus-text-dim)]">
            {selectedCard ? 'Ficha de la cámara' : 'Todas las cámaras'}
          </p>
          <div className="nv-cliente-list min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-width:thin]">
            {selectedCard ? (
              <CameraFicha card={selectedCard} unitSystem={project.unitSystem} />
            ) : (
              cards.map((card) => (
                <CameraFicha
                  key={card.id}
                  card={card}
                  unitSystem={project.unitSystem}
                  compact
                />
              ))
            )}
          </div>
        </aside>
      </div>

      <style>{`
        @media print {
          nav, [data-nv-copiar-enlace] { display: none !important; }
          .nv-cliente { color: #111 !important; height: auto !important; overflow: visible !important; }
          .nv-cliente-list { overflow: visible !important; height: auto !important; }
        }
      `}</style>
    </div>
  )
}
