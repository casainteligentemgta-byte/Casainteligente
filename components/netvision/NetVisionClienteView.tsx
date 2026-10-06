'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Printer, ArrowLeft, Link2, Check, Send, X } from 'lucide-react'
import NetVisionPlanoCliente, {
  PLANO_CLIENTE_TONO,
  SEMAFORO_CLIENTE_HEX,
  SEMAFORO_CLIENTE_OPACIDAD,
  type PaletaCobertura,
} from '@/components/netvision/NetVisionPlanoCliente'
import { FACE_ID_YELLOW_EXTRA_M } from '@/lib/netvision/services/coverageCalculator'
import NetVisionCameraVisionToggles from '@/components/netvision/NetVisionCameraVisionToggles'
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
  agruparFichasPorModelo,
  buildClienteCameraCard,
  totalClienteCableMeters,
  valorComun,
  type ClienteCameraCard,
  type GrupoFichas,
} from '@/lib/netvision/utils/clienteCameraCard'
import { formatLength } from '@/lib/netvision/utils/units'
import { buildPlanoRotulo } from '@/lib/netvision/utils/planoRotulo'
import { sugerirNombrePdfPlano } from '@/lib/netvision/utils/planoPrint'
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

/**
 * Varias cámaras del mismo modelo: la información del modelo se dice una sola
 * vez («CAM‑03, CAM‑04 y CAM‑05») y debajo va solo lo que cambia en cada una.
 */
function CameraFichaGrupo({
  grupo,
  unitSystem,
  onVerCamara,
}: {
  grupo: GrupoFichas
  unitSystem: NetVisionProject['unitSystem']
  onVerCamara: (id: string) => void
}) {
  const { cards } = grupo
  const modelo = cards[0]!
  const conexion = valorComun(cards, (c) => c.connectionLabel)
  const splitter = valorComun(cards, (c) => c.poeSplitterV ?? 0)
  const montaje = valorComun(cards, (c) => `${c.mountHeightM}|${c.tiltDeg}`)
  const alcance = valorComun(cards, (c) => resumenAlcanceUtil(c.alcanceUtil, unitSystem))
  const todasCableadas = cards.every((c) => c.wired)
  const metros = Math.round(cards.reduce((s, c) => s + (c.wired ? c.cableMeters : 0), 0) * 10) / 10
  return (
    <article
      data-nv-ficha-grupo={cards.length}
      className="nv-tac-scan border border-[#2e7d54] bg-[#0b1a14] p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pt-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5fbf8a]">
            {modelo.brand}
          </p>
          <h3 className="mt-0.5 text-xl font-bold uppercase leading-tight tracking-[0.06em] text-[#d6ffe5]">
            {modelo.modelName}
          </h3>
          <p data-nv-ficha-grupo-camaras className="mt-1 text-[12px] font-semibold leading-snug text-[#8cffb5]">
            {cards.length} cámaras: {grupo.etiquetas}
          </p>
        </div>
        <NetVisionCameraPhoto
          imageUrl={modelo.imageUrl}
          formFactor={modelo.formFactor}
          alt={`${modelo.brand} ${modelo.modelName}`}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-[#5fbf8a]">Forma</dt>
          <dd className="font-semibold text-[#d6ffe5]">{modelo.formLabel}</dd>
        </div>
        <div>
          <dt className="text-[#5fbf8a]">Resolución</dt>
          <dd className="font-semibold text-[#d6ffe5]">{modelo.resolution}</dd>
        </div>
        <div>
          <dt className="text-[#5fbf8a]">Ángulo</dt>
          <dd className="font-semibold text-[#d6ffe5]">{modelo.fovLabel}</dd>
        </div>
        <div>
          <dt className="text-[#5fbf8a]">Alcance</dt>
          <dd className="font-semibold text-[#d6ffe5]">
            {modelo.rangeDayM} m día / {modelo.rangeNightM} m noche
          </dd>
        </div>
      </dl>
      {modelo.notes ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[#a9e8c4]">{modelo.notes}</p>
      ) : null}
      {alcance ? (
        <p data-nv-alcance-resumen className="mt-2 text-[11px] leading-relaxed text-[#a9e8c4]">
          {alcance}
        </p>
      ) : null}
      {conexion ? (
        <p className="mt-2 text-[11px] font-bold text-[#8cffb5]">
          {conexion}
          {todasCableadas && modelo.poeWatts > 0 ? ` · ${modelo.poeWatts} W PoE cada una` : ''}
        </p>
      ) : null}
      {splitter !== null && todasCableadas ? (
        splitter ? (
          <p
            data-nv-splitter={splitter}
            className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#ffc857]"
          >
            <NetVisionSplitterSymbol size={14} />
            Cada una lleva adaptador PoE (splitter) de {splitter} V
          </p>
        ) : (
          <p data-nv-splitter="propio" className="mt-1 text-[11px] text-[#a9e8c4]">
            PoE propio: no llevan adaptador.
          </p>
        )
      ) : null}
      <p className="nv-no-print mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5fbf8a] print:hidden">
        Cada cámara · toca para verla en el plano
      </p>
      <ul className="mt-1 space-y-1">
        {cards.map((c) => {
          // Solo lo que cambia de una cámara a otra del mismo modelo.
          const detalles: string[] = []
          if (!conexion) detalles.push(c.connectionLabel)
          if (splitter === null && c.wired) {
            detalles.push(c.poeSplitterV ? `adaptador PoE de ${c.poeSplitterV} V` : 'PoE propio')
          }
          if (!montaje) detalles.push(`a ${formatLength(c.mountHeightM, unitSystem)} de altura`)
          if (!alcance) detalles.push(resumenAlcanceUtil(c.alcanceUtil, unitSystem))
          if (c.wired) {
            if (c.cables.length > 0) {
              for (const cable of c.cables) {
                detalles.push(
                  `${cable.typeLabel} → ${cable.toLabel}: ${formatLength(cable.meters, unitSystem)}`,
                )
              }
            } else {
              detalles.push('sin ruta de tendido en el plano')
            }
          }
          return (
            <li key={c.id}>
              <button
                type="button"
                data-nv-ficha-camara={c.id}
                onClick={() => onVerCamara(c.id)}
                className="flex min-h-11 w-full items-baseline gap-2 border border-[#1f5a3c] bg-[#07110d] px-2.5 py-2 text-left hover:border-[#8cffb5]"
              >
                <span className="shrink-0 text-[12px] font-bold text-[#d6ffe5]">{c.label}</span>
                <span className="min-w-0 text-[11px] leading-snug text-[#a9e8c4]">
                  {detalles.join(' · ')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {metros > 0 ? (
        <p className="mt-1.5 text-[11px] text-[#5fbf8a]">
          Total tendido de las {cards.length}:{' '}
          <span className="font-semibold text-[#d6ffe5]">{formatLength(metros, unitSystem)}</span>
        </p>
      ) : null}
    </article>
  )
}

function ListaFichas({
  cards,
  unitSystem,
  onVerCamara,
}: {
  cards: ClienteCameraCard[]
  unitSystem: NetVisionProject['unitSystem']
  onVerCamara: (id: string) => void
}) {
  return (
    <>
      {agruparFichasPorModelo(cards).map((grupo) =>
        grupo.cards.length === 1 ? (
          <CameraFicha
            key={grupo.clave}
            card={grupo.cards[0]!}
            unitSystem={unitSystem}
            compact
          />
        ) : (
          <CameraFichaGrupo
            key={grupo.clave}
            grupo={grupo}
            unitSystem={unitSystem}
            onVerCamara={onVerCamara}
          />
        ),
      )}
    </>
  )
}

/** Preferencia de cada visitante: no viaja con el proyecto. */
const CLAVE_PALETA = 'nexus.netvision.cliente.paleta'

export default function NetVisionClienteView() {
  const search = useSearchParams()
  const [project, setProject] = useState<NetVisionProject | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** El cableado estorba al cliente: se muestra solo si lo pide. */
  const [verCables, setVerCables] = useState(false)
  /** Cobertura en gama de verde o en semáforo; cada quien recuerda la suya. */
  const [paleta, setPaleta] = useState<PaletaCobertura>('tonos')
  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE_PALETA) === 'semaforo') setPaleta('semaforo')
    } catch {
      /* sin almacenamiento: queda la gama de verde */
    }
  }, [])
  const elegirPaleta = (p: PaletaCobertura) => {
    setPaleta(p)
    try {
      localStorage.setItem(CLAVE_PALETA, p)
    } catch {
      /* no se recuerda, pero se aplica */
    }
  }
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
  /** Reacomoda a hoja apaisada y luego abre el diálogo de imprimir / PDF. */
  const [imprimiendo, setImprimiendo] = useState(false)

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
  // «Ver solo esta»: las demás quedan apagadas por eso, no porque se quitaran una a una.
  const viendoUnaSola =
    selectedId != null &&
    !hiddenLive.includes(selectedId) &&
    hiddenLive.length === cameras.length - 1
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

  const imprimirPdf = () => {
    if (imprimiendo) return
    setImprimiendo(true)
  }

  useEffect(() => {
    if (!imprimiendo) return
    const prevTitle = document.title
    const nombre = sugerirNombrePdfPlano({
      projectName: project?.name,
      planoNombre: project?.planoNombre,
    })
    document.title = nombre
    document.documentElement.setAttribute('data-nv-print-cliente', '')
    let cancelado = false
    let listo = false
    const fin = () => {
      if (listo) return
      listo = true
      document.title = prevTitle
      document.documentElement.removeAttribute('data-nv-print-cliente')
      setImprimiendo(false)
    }
    const tPrint = window.setTimeout(() => {
      if (cancelado) return
      window.print()
    }, 220)
    const tFallback = window.setTimeout(fin, 12000)
    window.addEventListener('afterprint', fin)
    return () => {
      cancelado = true
      window.clearTimeout(tPrint)
      window.clearTimeout(tFallback)
      window.removeEventListener('afterprint', fin)
      document.title = prevTitle
      document.documentElement.removeAttribute('data-nv-print-cliente')
    }
  }, [imprimiendo, project?.name, project?.planoNombre])

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
      data-nv-imprimiendo={imprimiendo ? '' : undefined}
      className={`nv-cliente nv-tac-scan flex min-h-[28rem] flex-col gap-2.5 overflow-hidden border border-[#2e7d54] bg-[#07110d] p-3 font-mono text-[#8cffb5] print:h-auto print:min-h-0 print:overflow-visible ${
        esCompartido ? 'h-[calc(100dvh-1.5rem)]' : 'h-[calc(100dvh-7.25rem)]'
      }`}
    >
      <header
        data-nv-print-encabezado
        className="flex shrink-0 flex-wrap items-end justify-between gap-3"
      >
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
        <div className="nv-no-print flex flex-wrap gap-2 print:hidden">
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
            data-nv-imprimir-pdf
            disabled={imprimiendo}
            onClick={imprimirPdf}
            className="inline-flex min-h-11 items-center gap-1.5 bg-[#8cffb5] px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#07110d] hover:bg-[#d6ffe5] disabled:opacity-60"
          >
            <Printer className="h-3.5 w-3.5" />
            {imprimiendo ? 'Preparando…' : 'Imprimir / PDF'}
          </button>
        </div>
      </header>

      {!esCompartido && (shareUrl || shareMsg) ? (
        <div
          data-nv-compartir-panel
          className="nv-no-print shrink-0 space-y-2 border border-[#2e7d54] bg-[#0b1a14] p-2.5 text-[11px] print:hidden"
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

      <div
        data-nv-leyenda
        className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#d6ffe5]"
      >
        {/* Interruptor: gama de verde o semáforo translúcido. */}
        <span
          role="group"
          aria-label="Colores de la cobertura"
          data-nv-paleta={paleta}
          className="nv-no-print inline-flex print:hidden"
        >
          {(
            [
              { id: 'tonos', texto: 'Tonos de verde' },
              { id: 'semaforo', texto: 'Semáforo' },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              data-nv-paleta-opcion={op.id}
              aria-pressed={paleta === op.id}
              onClick={() => elegirPaleta(op.id)}
              className={`min-h-11 border px-3 text-[11px] font-bold uppercase tracking-[0.12em] ${
                paleta === op.id
                  ? 'border-[#8cffb5] bg-[#8cffb5] text-[#07110d]'
                  : 'border-[#2e7d54] text-[#d6ffe5] hover:border-[#8cffb5]'
              }`}
            >
              {op.texto}
            </button>
          ))}
        </span>
        {/* En palabras del cliente: qué se ve en cada zona del cono. */}
        {(paleta === 'semaforo'
          ? [
              { clave: 'cara', texto: 'Verde: se le ve la cara', color: SEMAFORO_CLIENTE_HEX.green, opacidad: SEMAFORO_CLIENTE_OPACIDAD + 0.35 },
              { clave: 'limite', texto: `Naranja: al límite (${FACE_ID_YELLOW_EXTRA_M} m más)`, color: SEMAFORO_CLIENTE_HEX.yellow, opacidad: SEMAFORO_CLIENTE_OPACIDAD + 0.35 },
              { clave: 'alguien', texto: 'Amarillo: se nota que hay alguien', color: SEMAFORO_CLIENTE_HEX.red, opacidad: SEMAFORO_CLIENTE_OPACIDAD + 0.35 },
            ]
          : [
              { clave: 'cara', texto: 'Se le ve la cara', color: PLANO_CLIENTE_TONO, opacidad: 0.75 },
              { clave: 'quien', texto: 'Se sabe quién es', color: PLANO_CLIENTE_TONO, opacidad: 0.42 },
              { clave: 'alguien', texto: 'Se nota que hay alguien', color: PLANO_CLIENTE_TONO, opacidad: 0.18 },
            ]
        ).map((z) => (
          <span key={z.clave} data-nv-leyenda-zona={z.clave} className="inline-flex items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 border"
              style={{ backgroundColor: z.color, opacity: z.opacidad, borderColor: z.color }}
            />
            {z.texto}
          </span>
        ))}
        <span className="inline-flex items-center gap-3 text-[#a9e8c4]">
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <circle cx="8" cy="8" r="6" fill="none" stroke="#e6f2ec" strokeWidth="1.8" />
            </svg>
            Domo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden>
              <rect x="2" y="3" width="14" height="10" rx="3" fill="none" stroke="#e6f2ec" strokeWidth="1.8" />
            </svg>
            Bala
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden>
              <polygon points="16,8 12.5,14 5.5,14 2,8 5.5,2 12.5,2" fill="none" stroke="#e6f2ec" strokeWidth="1.8" />
            </svg>
            PTZ (gira)
          </span>
        </span>
        {splitters > 0 ? (
          <span data-nv-leyenda-splitter className="inline-flex items-center gap-1.5 text-[#a9e8c4]">
            <NetVisionSplitterSymbol size={12} />
            Adaptador PoE (splitter)
          </span>
        ) : null}
        {cableRoutes.length > 0 ? (
          <button
            type="button"
            data-nv-ver-cables
            aria-pressed={verCables}
            onClick={() => setVerCables((v) => !v)}
            className={`nv-no-print ml-auto inline-flex min-h-11 items-center border px-3 text-[11px] font-bold uppercase tracking-[0.12em] print:hidden ${
              verCables
                ? 'border-[#f5c84b] bg-[#f5c84b] text-[#07110d]'
                : 'border-[#2e7d54] text-[#d6ffe5] hover:border-[#8cffb5]'
            }`}
          >
            {verCables ? 'Ocultar cableado' : 'Ver cableado'}
          </button>
        ) : null}
      </div>

      {cameras.length > 0 ? (
        <div className="nv-no-print shrink-0 print:hidden" data-nv-cam-toggles>
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
        <p className="nv-no-print text-[12px] text-[#a9e8c4] print:hidden">
          Este proyecto aún no tiene cámaras.
        </p>
      )}

      <div className="nv-cliente-grid grid min-h-0 flex-1 grid-rows-[minmax(200px,42dvh)_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:grid-rows-[minmax(0,1fr)]">
        <div
          className={`nv-print-plano-slot min-h-0 overflow-hidden bg-[#07110d]${
            cards.length > 0 ? ' nv-print-plano-con-fichas' : ''
          }`}
        >
          {project.planoUrl ? (
            <NetVisionPlanoRotulo
              variant="tactico"
              rotulo={buildPlanoRotulo({
                projectName: project.name,
                branch: 'cctv',
              })}
            >
            <NetVisionPlanoCliente
              planoUrl={project.planoUrl}
              cameras={cameras}
              networkNodes={project.networkNodes}
              planDevices={project.planDevices}
              structures={project.structures}
              sectors={sectors}
              cableRoutes={
                allOn
                  ? cableRoutes
                  : cableRoutes.filter(
                      (r) => !hiddenLive.includes(r.fromId) && !hiddenLive.includes(r.toId),
                    )
              }
              scale={project.scale}
              unitSystem={project.unitSystem}
              selectedId={selectedId}
              hiddenIds={hiddenLive}
              atenuar={viendoUnaSola}
              verCables={verCables}
              paleta={paleta}
              onSelect={(id) => {
                if (!id) {
                  showAll()
                  return
                }
                if (cameras.some((c) => c.id === id)) showSolo(id)
              }}
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

        <aside
          className={`nv-print-fichas flex min-h-0 flex-col${
            cards.length === 0 ? ' nv-no-print print:hidden' : ''
          }`}
        >
          <p className="nv-no-print shrink-0 px-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5fbf8a] print:hidden">
            {'// '}
            {selectedCard ? 'Ficha de la cámara' : 'Todas las cámaras'}
          </p>
          <p className="nv-solo-print mb-1.5 hidden shrink-0 px-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5fbf8a] print:block">
            {'// '}Cámaras a usar
          </p>
          <div
            className={`nv-cliente-list min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-y-contain pl-1 pr-1.5 pt-1 [scrollbar-color:#2e7d54_transparent] [scrollbar-width:thin] ${
              selectedCard ? 'nv-no-print print:hidden' : ''
            }`}
          >
            {selectedCard ? (
              <CameraFicha card={selectedCard} unitSystem={project.unitSystem} />
            ) : (
              <ListaFichas cards={cards} unitSystem={project.unitSystem} onVerCamara={showSolo} />
            )}
          </div>
          {selectedCard ? (
            <div className="nv-cliente-list nv-solo-print hidden space-y-2.5 print:block">
              <ListaFichas cards={cards} unitSystem={project.unitSystem} onVerCamara={showSolo} />
            </div>
          ) : null}
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
        /* Antes de imprimir: misma composición que el PDF (hoja apaisada). */
        html[data-nv-print-cliente] [data-nv-shell-chrome] {
          display: none !important;
        }
        html[data-nv-print-cliente] main {
          padding: 0 !important;
        }
        .nv-cliente[data-nv-imprimiendo] .nv-no-print {
          display: none !important;
        }
        .nv-cliente[data-nv-imprimiendo] .nv-solo-print {
          display: block !important;
        }
        .nv-cliente[data-nv-imprimiendo] {
          display: flex !important;
          flex-direction: column !important;
          height: auto !important;
          overflow: visible !important;
          border: none !important;
          padding: 7mm !important;
        }
        .nv-cliente[data-nv-imprimiendo] .nv-tac-scan {
          background-image: none !important;
        }
        .nv-cliente[data-nv-imprimiendo] .nv-cliente-grid {
          display: contents;
        }
        .nv-cliente[data-nv-imprimiendo] [data-nv-print-encabezado],
        .nv-cliente[data-nv-imprimiendo] [data-nv-leyenda] {
          break-after: avoid;
          page-break-after: avoid;
        }
        .nv-cliente[data-nv-imprimiendo] .nv-print-plano-slot {
          width: 100%;
          height: 150mm;
          min-height: 150mm;
          overflow: hidden;
        }
        .nv-cliente[data-nv-imprimiendo] .nv-print-plano-slot .nv-plano-rotulo {
          height: 100%;
        }
        .nv-cliente[data-nv-imprimiendo] .nv-print-fichas {
          width: 48%;
          max-width: 140mm;
        }
        @page {
          size: A4 landscape;
          margin: 0;
        }
        @media print {
          nav,
          [data-nv-copiar-enlace],
          [data-nv-shell-chrome] { display: none !important; }
          main { padding: 0 !important; }
          .nv-no-print { display: none !important; }
          .nv-solo-print { display: block !important; }
          html, body {
            background: #07110d !important;
          }
          .nv-cliente, .nv-cliente * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .nv-tac-scan {
            background-image: none !important;
          }
          .nv-cliente {
            display: flex !important;
            flex-direction: column !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            background: #07110d !important;
            padding: 7mm !important;
          }
          .nv-cliente-grid { display: contents !important; }
          [data-nv-print-encabezado],
          [data-nv-leyenda] {
            break-after: avoid;
            page-break-after: avoid;
          }
          .nv-print-plano-con-fichas {
            break-after: page;
            page-break-after: always;
          }
          .nv-print-plano-slot {
            width: 100% !important;
            height: 150mm !important;
            min-height: 150mm !important;
            max-height: 150mm !important;
            overflow: hidden !important;
          }
          .nv-print-plano-slot .nv-plano-rotulo {
            height: 100% !important;
          }
          .nv-print-fichas {
            width: 48% !important;
            max-width: 140mm !important;
          }
          .nv-cliente-list {
            overflow: visible !important;
            height: auto !important;
          }
          [data-nv-ficha],
          [data-nv-ficha-grupo] {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
