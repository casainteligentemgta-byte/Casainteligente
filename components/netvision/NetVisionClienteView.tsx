'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Printer, ArrowLeft, Link2, Check, Send, X } from 'lucide-react'
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
import {
  cloudCompartir,
  cloudDejarDeCompartir,
  cloudEstadoCompartir,
  cloudProyectoCompartido,
  cloudUpsertProject,
} from '@/lib/netvision/cloud'
import {
  PARAM_COMPARTIDO,
  esTokenCompartir,
  urlCompartida,
} from '@/lib/netvision/compartir'
import { descargarPlanoFirmado, subirPlanoNube } from '@/lib/netvision/planoNube'
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
import NetVisionCameraPhoto from '@/components/netvision/NetVisionCameraPhoto'
import NetVisionAlcanceUtil from '@/components/netvision/NetVisionAlcanceUtil'
import { resumenAlcanceUtil } from '@/lib/netvision/services/dimensionamiento'
import NetVisionSplitterSymbol from '@/components/netvision/NetVisionSplitterSymbol'
import { contarSplittersPoe, esCamaraCableada } from '@/lib/netvision/catalog/cameras'

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
      className="nv-tac-scan border border-[#2e7d54] bg-[#0b1a14] p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pt-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5fbf8a]">
            {card.brand}
          </p>
          <h3 className="mt-0.5 text-xl font-bold uppercase leading-tight tracking-[0.06em] text-[#d6ffe5]">
            {card.label}
          </h3>
          <p className="mt-0.5 text-[12px] font-semibold text-[#8cffb5]">{card.modelName}</p>
        </div>
        <NetVisionCameraPhoto
          imageUrl={card.imageUrl}
          formFactor={card.formFactor}
          alt={`${card.brand} ${card.modelName}`}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-[#5fbf8a]">Forma</dt>
          <dd className="font-semibold text-[#d6ffe5]">{card.formLabel}</dd>
        </div>
        <div>
          <dt className="text-[#5fbf8a]">Resolución</dt>
          <dd className="font-semibold text-[#d6ffe5]">{card.resolution}</dd>
        </div>
        <div>
          <dt className="text-[#5fbf8a]">Ángulo</dt>
          <dd className="font-semibold text-[#d6ffe5]">{card.fovLabel}</dd>
        </div>
        <div>
          <dt className="text-[#5fbf8a]">Alcance</dt>
          <dd className="font-semibold text-[#d6ffe5]">
            {card.rangeDayM} m día / {card.rangeNightM} m noche
          </dd>
        </div>
        {!compact ? (
          <>
            <div>
              <dt className="text-[#5fbf8a]">Montaje</dt>
              <dd className="font-semibold text-[#d6ffe5]">
                {formatLength(card.mountHeightM, unitSystem)} · {card.tiltDeg}°
              </dd>
            </div>
            <div>
              <dt className="text-[#5fbf8a]">Señal</dt>
              <dd className="font-semibold text-[#d6ffe5]">{card.bitrateMbps} Mbps</dd>
            </div>
          </>
        ) : null}
      </dl>
      {card.notes ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[#a9e8c4]">{card.notes}</p>
      ) : null}
      {compact ? (
        <p data-nv-alcance-resumen className="mt-2 text-[11px] leading-relaxed text-[#a9e8c4]">
          {resumenAlcanceUtil(card.alcanceUtil, unitSystem)}
        </p>
      ) : (
        <div className="mt-2">
          <NetVisionAlcanceUtil
            alcance={card.alcanceUtil}
            unitSystem={unitSystem}
            variant="tactico"
          />
        </div>
      )}
      <p className="mt-2 text-[11px] font-bold text-[#8cffb5]">
        {card.connectionLabel}
        {card.wired && card.poeWatts > 0 ? ` · ${card.poeWatts} W PoE` : ''}
      </p>
      {card.poeSplitterV ? (
        <p
          data-nv-splitter={card.poeSplitterV}
          className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#ffc857]"
        >
          <NetVisionSplitterSymbol size={14} />
          Adaptador PoE (splitter) de {card.poeSplitterV} V
        </p>
      ) : card.wired ? (
        <p data-nv-splitter="propio" className="mt-1 text-[11px] text-[#a9e8c4]">
          PoE propio: no lleva adaptador.
        </p>
      ) : null}
      {card.wired ? (
        card.cables.length > 0 ? (
          <ul className="mt-1.5 space-y-1 text-[12px] text-[#a9e8c4]">
            {card.cables.map((c) => (
              <li key={c.id}>
                {c.typeLabel} → {c.toLabel}:{' '}
                <span className="font-semibold text-[#d6ffe5]">
                  {formatLength(c.meters, unitSystem)}
                </span>
              </li>
            ))}
            <li className="pt-0.5 text-[11px] text-[#5fbf8a]">
              Total tendido:{' '}
              <span className="font-semibold text-[#d6ffe5]">
                {formatLength(card.cableMeters, unitSystem)}
              </span>
            </li>
          </ul>
        ) : (
          <p className="mt-1 text-[11px] text-[#ffc857]">
            Cableada, pero aún no hay ruta de tendido en el plano.
          </p>
        )
      ) : (
        <p className="mt-1 text-[11px] text-[#a9e8c4]">
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
  /** Código del enlace (?c=): quien abre es el cliente, en modo solo lectura. */
  const tokenRaw = search.get(PARAM_COMPARTIDO)
  const tokenCompartido = esTokenCompartir(tokenRaw) ? tokenRaw : null
  const esCompartido = tokenRaw != null
  const [estadoCompartido, setEstadoCompartido] = useState<'cargando' | 'listo' | 'error'>(
    esCompartido ? 'cargando' : 'listo',
  )
  const [errorCompartido, setErrorCompartido] = useState<string | null>(null)
  /** Plano del enlace del cliente: se baja aparte y puede tardar unos segundos. */
  const [planoEstado, setPlanoEstado] = useState<'no' | 'cargando' | 'error'>('no')
  const [planoIntento, setPlanoIntento] = useState(0)
  /** Enlace ya creado para este proyecto (lado del instalador). */
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  useEffect(() => {
    const cam = search.get('cam')
    const enfocar = (loaded: NetVisionProject | null) => {
      if (cam && loaded?.cameras.some((c) => c.id === cam)) {
        setSelectedId(cam)
        setHiddenIds(isolateHiddenCameraIds(loaded.cameras.map((c) => c.id), cam))
      } else {
        setSelectedId(null)
        setHiddenIds([])
      }
    }

    if (!esCompartido) {
      const loaded = loadClienteProject(search.get('id'))
      setProject(loaded)
      setEstadoCompartido('listo')
      enfocar(loaded)
      return
    }

    // Enlace del cliente: el proyecto viene de la nube, no de este navegador.
    let cancelado = false
    setProject(null)
    setPlanoEstado('no')
    if (!tokenCompartido) {
      setEstadoCompartido('error')
      setErrorCompartido('Enlace no válido.')
      return
    }
    setEstadoCompartido('cargando')
    setErrorCompartido(null)
    void cloudProyectoCompartido(tokenCompartido).then(async (r) => {
      if (cancelado) return
      if (!r.ok || !r.project) {
        setEstadoCompartido('error')
        setErrorCompartido(r.error || 'No se pudo abrir el enlace.')
        return
      }
      const loaded = r.project
      setProject(loaded)
      setEstadoCompartido('listo')
      enfocar(loaded)
      if (!loaded.planoUrl && r.planoSignedUrl) {
        setPlanoEstado('cargando')
        const plano = await descargarPlanoFirmado(r.planoSignedUrl)
        if (cancelado) return
        if (plano) {
          setProject((p) => (p && p.id === loaded.id ? { ...p, planoUrl: plano } : p))
          setPlanoEstado('no')
        } else {
          setPlanoEstado('error')
        }
      }
    })
    return () => {
      cancelado = true
    }
  }, [search, esCompartido, tokenCompartido, planoIntento])

  // Lado del instalador: ¿este proyecto ya tiene enlace para el cliente?
  const projectId = project?.id ?? null
  useEffect(() => {
    if (esCompartido || !projectId) return
    let cancelado = false
    setShareUrl(null)
    void cloudEstadoCompartir(projectId).then((r) => {
      if (cancelado || !r.ok || !r.token) return
      setShareUrl(urlCompartida(window.location.origin, r.token))
    })
    return () => {
      cancelado = true
    }
  }, [esCompartido, projectId])

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
  const splitters = contarSplittersPoe(cameras)
  const cableadas = cameras.filter(esCamaraCableada).length
  const poePropio = Math.max(0, cableadas - splitters)
  const porWifi = cameras.length - cableadas

  const showAll = () => {
    setHiddenIds([])
    setSelectedId(null)
  }
  const showSolo = (id: string) => {
    setHiddenIds(isolateHiddenCameraIds(cameraIds, id))
    setSelectedId(id)
  }

  const copiarEnlace = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      return true
    } catch {
      setCopied(false)
      return false
    }
  }

  /**
   * Crea el enlace para el cliente: guarda el proyecto y el plano en la nube y
   * pide el código. El enlace muestra siempre la última versión guardada.
   */
  const compartir = async () => {
    if (!project || sharing) return
    setSharing(true)
    setShareMsg('Preparando el enlace…')
    try {
      const guardado = await cloudUpsertProject(project)
      if (!guardado.authenticated) {
        setShareMsg('Inicia sesión para compartir el proyecto con el cliente.')
        return
      }
      if (guardado.conflict) {
        setShareMsg(
          'La nube tiene otra versión de este proyecto. Ábrelo en el editor, elige con cuál te quedas y vuelve a compartir.',
        )
        return
      }
      if (!guardado.ok) {
        setShareMsg(`No se pudo guardar en la nube: ${guardado.error ?? 'error desconocido'}`)
        return
      }
      const plano = await subirPlanoNube(project, { forzar: true })
      if (!plano.ok) {
        setShareMsg(`No se pudo subir el plano: ${plano.error}`)
        return
      }
      const r = await cloudCompartir(project.id)
      if (!r.ok || !r.token) {
        setShareMsg(`No se pudo crear el enlace: ${r.error ?? 'error desconocido'}`)
        return
      }
      const url = urlCompartida(window.location.origin, r.token)
      setShareUrl(url)
      const copiado = await copiarEnlace(url)
      setShareMsg(
        copiado
          ? 'Enlace copiado. El cliente verá siempre la última versión guardada.'
          : 'Enlace listo. Cópialo o envíalo; el cliente verá siempre la última versión guardada.',
      )
    } finally {
      setSharing(false)
    }
  }

  const dejarDeCompartir = async () => {
    if (!project || sharing) return
    if (!window.confirm('El enlace que enviaste dejará de abrir. ¿Dejar de compartir?')) return
    setSharing(true)
    try {
      const r = await cloudDejarDeCompartir(project.id)
      if (r.ok) {
        setShareUrl(null)
        setShareMsg('El proyecto ya no está compartido.')
      } else {
        setShareMsg(`No se pudo anular el enlace: ${r.error ?? 'error desconocido'}`)
      }
    } finally {
      setSharing(false)
    }
  }

  const enviarEnlace = async () => {
    if (!shareUrl || !project) return
    try {
      await navigator.share({ title: `Proyecto ${project.name}`, url: shareUrl })
    } catch {
      /* el usuario canceló o el navegador no lo permite */
    }
  }
  const puedeEnviar = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  if (esCompartido && estadoCompartido !== 'listo') {
    return (
      <div
        data-nv-compartido-estado={estadoCompartido}
        className="border border-[#2e7d54] bg-[#07110d] p-6 font-mono text-sm text-[#a9e8c4]"
      >
        {estadoCompartido === 'cargando'
          ? 'Abriendo el proyecto…'
          : errorCompartido || 'No se pudo abrir el enlace.'}
      </div>
    )
  }

  if (!project) {
    return (
      <div className="border border-[#2e7d54] bg-[#07110d] p-6 font-mono text-sm text-[#a9e8c4]">
        No hay un proyecto NetVision en este navegador.{' '}
        <Link href="/nexus/vision" className="font-semibold text-[#8cffb5] underline">
          Abrir el editor
        </Link>
      </div>
    )
  }

  return (
    <div
      data-nv-cliente-modo={esCompartido ? 'compartido' : 'instalador'}
      className={`nv-cliente nv-tac-scan flex min-h-[28rem] flex-col gap-2.5 overflow-hidden border border-[#2e7d54] bg-[#07110d] p-3 font-mono text-[#8cffb5] print:h-auto print:min-h-0 print:overflow-visible ${
        esCompartido ? 'h-[calc(100dvh-1.5rem)]' : 'h-[calc(100dvh-7.25rem)]'
      }`}
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5fbf8a]">
            Presentación cliente // NetVision
          </p>
          <h1 className="mt-0.5 text-2xl font-bold uppercase leading-tight tracking-[0.1em] text-[#d6ffe5] sm:text-3xl">
            {project.name || 'Proyecto'}
          </h1>
          {project.client ? (
            <p className="text-[12px] text-[#a9e8c4]">
              <span className="text-[#5fbf8a]">Cliente:</span> {project.client}
            </p>
          ) : null}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#a9e8c4]">
            <span className="bg-[#8cffb5] px-2 py-0.5 font-bold uppercase tracking-[0.14em] text-[#07110d]">
              {cameras.length} cámara{cameras.length === 1 ? '' : 's'}
            </span>
            {cableTotal > 0 ? (
              <span>{formatLength(cableTotal, project.unitSystem)} de cable PoE</span>
            ) : null}
            {splitters > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <NetVisionSplitterSymbol size={12} />
                {splitters} adaptador{splitters === 1 ? '' : 'es'} PoE
              </span>
            ) : null}
            {poePropio > 0 ? (
              <span data-nv-poe-propio>
                {poePropio} con PoE propio
              </span>
            ) : null}
            {porWifi > 0 ? (
              <span data-nv-wifi>
                {porWifi} por Wi‑Fi
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {!esCompartido ? (
            <>
              <Link
                href="/nexus/vision"
                className="inline-flex min-h-11 items-center gap-1.5 border border-[#8cffb5] px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8cffb5] hover:bg-[#8cffb5]/10"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Editor
              </Link>
              <button
                type="button"
                data-nv-compartir
                disabled={sharing}
                onClick={() => void compartir()}
                className="inline-flex min-h-11 items-center gap-1.5 border border-[#8cffb5] px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8cffb5] hover:bg-[#8cffb5]/10 disabled:opacity-50"
              >
                <Link2 className="h-3.5 w-3.5" />
                {sharing ? 'Preparando…' : shareUrl ? 'Actualizar enlace' : 'Compartir con cliente'}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-1.5 bg-[#8cffb5] px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#07110d] hover:bg-[#d6ffe5]"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir / PDF
          </button>
        </div>
      </header>

      {!esCompartido && (shareUrl || shareMsg) ? (
        <div
          data-nv-compartir-panel
          className="shrink-0 space-y-2 border border-[#2e7d54] bg-[#0b1a14] p-2.5 text-[11px] print:hidden"
        >
          {shareMsg ? (
            <p data-nv-compartir-msg className="text-[#d6ffe5]">
              {shareMsg}
            </p>
          ) : (
            <p className="text-[#a9e8c4]">
              Este proyecto está compartido. El cliente ve siempre la última versión guardada.
            </p>
          )}
          {shareUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                data-nv-compartir-url
                value={shareUrl}
                aria-label="Enlace para el cliente"
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-10 min-w-0 flex-1 basis-56 border border-[#2e7d54] bg-[#07110d] px-2 text-[11px] text-[#d6ffe5]"
              />
              <button
                type="button"
                data-nv-copiar-enlace
                onClick={() => void copiarEnlace(shareUrl)}
                className="inline-flex min-h-10 items-center gap-1.5 border border-[#8cffb5] px-3 font-bold uppercase tracking-[0.12em] text-[#8cffb5]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              {puedeEnviar ? (
                <button
                  type="button"
                  onClick={() => void enviarEnlace()}
                  className="inline-flex min-h-10 items-center gap-1.5 bg-[#8cffb5] px-3 font-bold uppercase tracking-[0.12em] text-[#07110d]"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </button>
              ) : null}
              <button
                type="button"
                data-nv-dejar-compartir
                disabled={sharing}
                onClick={() => void dejarDeCompartir()}
                className="inline-flex min-h-10 items-center gap-1.5 border border-[#ffc857] px-3 font-bold uppercase tracking-[0.12em] text-[#ffc857] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Dejar de compartir
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#a9e8c4] print:hidden">
        <span className="font-semibold uppercase tracking-[0.22em] text-[#5fbf8a]">Semáforo</span>
        {VISION_SEMAFORO_LEGEND.map((item) => (
          <span key={item.band} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2" style={{ backgroundColor: item.hex }} />
            {item.label}
          </span>
        ))}
        {splitters > 0 ? (
          <span data-nv-leyenda-splitter className="inline-flex items-center gap-1.5">
            <NetVisionSplitterSymbol size={12} />
            Adaptador PoE (splitter)
          </span>
        ) : null}
      </div>

      {cameras.length > 0 ? (
        <div className="shrink-0 print:hidden" data-nv-cam-toggles>
          <NetVisionCameraVisionToggles
            cameras={cameras}
            hiddenIds={hiddenLive}
            readOnlyHint
            variant="tactico"
            onShowAll={showAll}
            onSolo={showSolo}
            onToggle={(id) => setHiddenIds((prev) => toggleHiddenCameraId(prev, id))}
            onSelect={setSelectedId}
          />
        </div>
      ) : (
        <p className="text-[12px] text-[#a9e8c4]">Este proyecto aún no tiene cámaras.</p>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(200px,42dvh)_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:grid-rows-[minmax(0,1fr)]">
        <div className="min-h-0 overflow-hidden bg-[#07110d] print:min-h-[360px]">
          {project.planoUrl ? (
            <NetVisionPlanoRotulo
              variant="tactico"
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
              showCameraLabels={false}
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
          ) : planoEstado === 'cargando' ? (
            <p
              data-nv-plano-estado="cargando"
              className="border border-[#2e7d54] p-6 text-sm text-[#a9e8c4]"
            >
              Cargando el plano…
            </p>
          ) : planoEstado === 'error' ? (
            <div
              data-nv-plano-estado="error"
              className="space-y-3 border border-[#2e7d54] p-6 text-sm text-[#a9e8c4]"
            >
              <p>No se pudo cargar el plano. Revisa tu conexión.</p>
              <button
                type="button"
                onClick={() => setPlanoIntento((n) => n + 1)}
                className="min-h-11 border border-[#8cffb5] px-4 font-semibold text-[#8cffb5]"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <p
              data-nv-plano-estado="sin-plano"
              className="border border-[#2e7d54] p-6 text-sm text-[#a9e8c4]"
            >
              Este proyecto no tiene plano cargado.
            </p>
          )}
        </div>

        <aside className="flex min-h-0 flex-col">
          <p className="shrink-0 px-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5fbf8a]">
            {'// '}
            {selectedCard ? 'Ficha de la cámara' : 'Todas las cámaras'}
          </p>
          <div className="nv-cliente-list min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-y-contain pl-1 pr-1.5 pt-1 [scrollbar-color:#2e7d54_transparent] [scrollbar-width:thin]">
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
        /* Líneas de barrido sobre los paneles; el plano queda limpio. */
        .nv-tac-scan {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.22) 0px,
            rgba(0, 0, 0, 0.22) 1px,
            transparent 1px,
            transparent 3px
          );
        }
        @media print {
          nav, [data-nv-copiar-enlace] { display: none !important; }
          /* La hoja sale igual que en pantalla (fondo oscuro y verde). */
          .nv-cliente, .nv-cliente * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .nv-cliente { height: auto !important; overflow: visible !important; }
          .nv-cliente-list { overflow: visible !important; height: auto !important; }
        }
      `}</style>
    </div>
  )
}
