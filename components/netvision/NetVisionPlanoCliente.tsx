'use client'

/**
 * Plano de la presentación al cliente: fondo oscuro, una sola gama de color
 * para la cobertura (tres zonas: se le ve la cara / se sabe quién es / se nota
 * que hay alguien), pines con número, forma según el tipo de cámara y cuña de
 * dirección. Solo lectura. Se dibuja con HTML + SVG (no Konva): imprime nítido
 * y se mueve con un dedo, pellizco o rueda.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { getCameraModelOrDefault, splitterDeCamara } from '@/lib/netvision/catalog/cameras'
import type {
  CableRoute,
  CoverageSector,
  DesignCamera,
  DesignNetworkNode,
  DesignPlanDevice,
  DesignStructure,
  NetVisionProject,
  ScaleCalibration,
  VisionBand,
} from '@/lib/netvision/types'
import {
  cajaDePuntos,
  cunaDeDireccion,
  cunaDeSector,
  encuadrar,
  hexagono,
  limitesDeZoom,
  mundoDePlano,
  numeroDePin,
  tintaDelPlano,
  unirCajas,
  zonasDeSector,
  zoomEn,
  type TintaPlano,
  type Vista,
} from '@/lib/netvision/utils/planoCliente'
import { formatLength } from '@/lib/netvision/utils/units'
import { VISION_SEMAFORO_HEX } from '@/lib/netvision/utils/visionSemaforoPalette'

/** Color único de la cobertura (más intenso = se ve mejor). */
export const PLANO_CLIENTE_TONO = '#34d399'

/** Cómo se colorea la cobertura: una sola gama de verde o el semáforo del editor. */
export type PaletaCobertura = 'tonos' | 'semaforo'

/** Opacidad del semáforo: translúcido para que el plano se siga viendo. */
export const SEMAFORO_CLIENTE_OPACIDAD = 0.3

/**
 * Semáforo que ve el cliente: verde, naranja y amarillo. Sin rojo: el cliente
 * leería «ahí no se ve nada», y en esa zona la cámara sí ve (con menos detalle).
 * Las claves son las bandas del editor; solo cambia el color de la más lejana.
 */
export const SEMAFORO_CLIENTE_HEX: Record<VisionBand, string> = {
  green: VISION_SEMAFORO_HEX.green,
  yellow: VISION_SEMAFORO_HEX.yellow,
  red: '#FFD600',
}
const FONDO = '#0b1411'
const TINTA = '#e6f2ec'
const RADIO_PIN = 13
const TOQUE_PX = 24

type Props = {
  planoUrl: string
  cameras: DesignCamera[]
  networkNodes: DesignNetworkNode[]
  planDevices?: DesignPlanDevice[]
  structures?: DesignStructure[]
  sectors: CoverageSector[]
  cableRoutes: CableRoute[]
  scale: ScaleCalibration
  unitSystem: NetVisionProject['unitSystem']
  selectedId: string | null
  /** Cámaras con la cobertura apagada. */
  hiddenIds: string[]
  /** Las apagadas lo están por ver una sola: se dejan tenues en vez de quitarlas. */
  atenuar: boolean
  verCables: boolean
  /** 'tonos' (por defecto): gama de verde. 'semaforo': verde / naranja / amarillo translúcido. */
  paleta?: PaletaCobertura
  onSelect: (id: string | null) => void
}

function useTamanoMarco(
  ref: React.RefObject<HTMLDivElement>,
  pausaRef: React.MutableRefObject<boolean>,
) {
  const [tam, setTam] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      // Mientras se imprime el marco cambia de tamaño a escala: no se re-mide.
      if (pausaRef.current) return
      const r = el.getBoundingClientRect()
      setTam((t) =>
        Math.abs(t.w - r.width) < 0.5 && Math.abs(t.h - r.height) < 0.5
          ? t
          : { w: r.width, h: r.height },
      )
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, pausaRef])
  return tam
}

/** Proporción de la imagen, dónde está el dibujo en la hoja y si ya es oscura. */
function useImagenPlano(url: string) {
  const [info, setInfo] = useState<{ url: string; aspecto: number; tinta: TintaPlano } | null>(null)
  useEffect(() => {
    let cancelado = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelado || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) return
      const aspecto = img.naturalHeight / img.naturalWidth
      let tinta: TintaPlano = { caja: null, oscuro: false }
      try {
        const w = 180
        const h = Math.max(1, Math.round(w * aspecto))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, w, h)
          ctx.drawImage(img, 0, 0, w, h)
          tinta = tintaDelPlano(ctx.getImageData(0, 0, w, h).data, w, h)
        }
      } catch {
        /* imagen de otro origen: se muestra entera */
      }
      setInfo({ url, aspecto, tinta })
    }
    img.src = url
    return () => {
      cancelado = true
    }
  }, [url])
  return info && info.url === url ? info : null
}

type FormaProps = {
  fill?: string
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  vectorEffect?: 'non-scaling-stroke'
}

const pct = (valor: number, total: number) => (total > 0 ? `${(valor / total) * 100}%` : 0)

const ETIQUETA_RED: Record<DesignNetworkNode['kind'], string> = {
  nvr: 'NVR',
  switch: 'SW',
  injector: 'PoE',
  ap: '',
}

export default function NetVisionPlanoCliente({
  planoUrl,
  cameras,
  networkNodes,
  planDevices = [],
  structures = [],
  sectors,
  cableRoutes,
  scale,
  unitSystem,
  selectedId,
  hiddenIds,
  atenuar,
  verCables,
  paleta = 'tonos',
  onSelect,
}: Props) {
  const marcoRef = useRef<HTMLDivElement>(null)
  const imprimiendoRef = useRef(false)
  const { w: marcoW, h: marcoH } = useTamanoMarco(marcoRef, imprimiendoRef)
  const imagen = useImagenPlano(planoUrl)
  const mundo = useMemo(() => mundoDePlano(imagen?.aspecto ?? scale.aspect), [imagen, scale.aspect])
  const [vista, setVista] = useState<Vista>({ k: 1, x: 0, y: 0 })
  /** El usuario ya movió o amplió: no se vuelve a encuadrar solo. */
  const tocadoRef = useRef(false)

  // Caja de lo que hay que ver: el dibujo de la hoja y los equipos. La cobertura
  // no cuenta (un cono largo hacia el vacío achicaría el plano). Si no se pudo
  // analizar la imagen, se muestra la hoja entera.
  const caja = useMemo(() => {
    const dibujo = imagen?.tinta.caja
    if (!dibujo) return null
    const equipos = cajaDePuntos([
      ...cameras.map((c) => ({ x: c.x, y: c.y })),
      ...networkNodes.map((n) => ({ x: n.x, y: n.y })),
      ...planDevices.map((d) => ({ x: d.x, y: d.y })),
    ])
    return unirCajas([dibujo, equipos])
  }, [cameras, networkNodes, planDevices, imagen])

  const limites = useMemo(() => limitesDeZoom(mundo, marcoW, marcoH), [mundo, marcoW, marcoH])

  const ajustar = useCallback(() => {
    tocadoRef.current = false
    setVista(encuadrar(caja, mundo, marcoW, marcoH))
  }, [caja, mundo, marcoW, marcoH])

  useEffect(() => {
    if (tocadoRef.current || !(marcoW > 0) || !(marcoH > 0)) return
    setVista(encuadrar(caja, mundo, marcoW, marcoH))
  }, [caja, mundo, marcoW, marcoH])

  // Otro plano: se vuelve a encuadrar.
  useEffect(() => {
    tocadoRef.current = false
  }, [planoUrl])

  // Al imprimir: si ya se preparó la hoja apaisada, se congela ese marco.
  // Si el usuario usa Ctrl+P, se fuerza proporción horizontal (A4 landscape).
  useEffect(() => {
    const el = marcoRef.current
    if (!el) return
    const congelar = () => {
      imprimiendoRef.current = true
      const apaisado = el.closest('[data-nv-imprimiendo]')
      if (apaisado) {
        const r = el.getBoundingClientRect()
        if (!(r.width > 0) || !(r.height > 0)) return
        el.style.aspectRatio = `${r.width} / ${r.height}`
        el.style.height = 'auto'
        return
      }
      el.style.width = '100%'
      el.style.height = 'auto'
      el.style.aspectRatio = '297 / 148'
    }
    const soltar = () => {
      el.style.aspectRatio = ''
      el.style.height = ''
      el.style.width = ''
      imprimiendoRef.current = false
    }
    window.addEventListener('beforeprint', congelar)
    window.addEventListener('afterprint', soltar)
    return () => {
      window.removeEventListener('beforeprint', congelar)
      window.removeEventListener('afterprint', soltar)
    }
  }, [])

  const zoomCentro = (factor: number) => {
    tocadoRef.current = true
    setVista((v) => zoomEn(v, factor, marcoW / 2, marcoH / 2, limites.min, limites.max))
  }

  // Rueda del ratón: acerca o aleja donde está el cursor.
  useEffect(() => {
    const el = marcoRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      tocadoRef.current = true
      setVista((v) =>
        zoomEn(v, Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top, limites.min, limites.max),
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [limites.min, limites.max])

  const px = (nx: number) => vista.x + nx * mundo.ancho * vista.k
  const py = (ny: number) => vista.y + ny * mundo.alto * vista.k

  // Un dedo mueve, dos dedos amplían; un toque sin mover elige la cámara.
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const pellizco = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const recorrido = useRef(0)
  const local = (e: React.PointerEvent) => {
    const r = marcoRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-nv-plano-control]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (punteros.current.size === 0) recorrido.current = 0
    punteros.current.set(e.pointerId, local(e))
    pellizco.current = null
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const previo = punteros.current.get(e.pointerId)
    if (!previo) return
    const ahora = local(e)
    punteros.current.set(e.pointerId, ahora)
    const todos = Array.from(punteros.current.values())
    if (todos.length === 1) {
      const dx = ahora.x - previo.x
      const dy = ahora.y - previo.y
      recorrido.current += Math.abs(dx) + Math.abs(dy)
      if (recorrido.current > 6) {
        tocadoRef.current = true
        setVista((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
      }
      return
    }
    const [a, b] = todos as [{ x: number; y: number }, { x: number; y: number }]
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const antes = pellizco.current
    pellizco.current = { dist, cx, cy }
    recorrido.current += 10
    if (!antes) return
    tocadoRef.current = true
    setVista((v) => {
      const z = zoomEn(v, dist / antes.dist, cx, cy, limites.min, limites.max)
      return { ...z, x: z.x + (cx - antes.cx), y: z.y + (cy - antes.cy) }
    })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const estaba = punteros.current.get(e.pointerId)
    punteros.current.delete(e.pointerId)
    pellizco.current = null
    if (!estaba || punteros.current.size > 0 || recorrido.current > 6) return
    // Toque: la cámara más cercana dentro del radio de un dedo; si no, todas.
    const p = local(e)
    let mejor: { id: string; d: number } | null = null
    for (const cam of cameras) {
      const d = Math.hypot(px(cam.x) - p.x, py(cam.y) - p.y)
      if (d <= TOQUE_PX && (!mejor || d < mejor.d)) mejor = { id: cam.id, d }
    }
    onSelect(mejor ? mejor.id : null)
  }

  const camPorId = useMemo(() => new Map(cameras.map((c) => [c.id, c])), [cameras])
  const hayAislada = atenuar && selectedId != null

  const coberturas = sectors
    .map((s, i) => {
      const cam = camPorId.get(s.cameraId)
      if (!cam) return null
      const elegida = s.cameraId === selectedId
      const apagada = hiddenIds.includes(s.cameraId)
      if (apagada && !elegida && !hayAislada) return null
      const nivel: 'resaltada' | 'normal' | 'atenuada' = elegida
        ? 'resaltada'
        : apagada
          ? 'atenuada'
          : 'normal'
      return { s, cam, nivel, i, zonas: zonasDeSector(s, cam, scale) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // La elegida se pinta al final, encima de las demás.
    .sort((a, b) => Number(a.nivel === 'resaltada') - Number(b.nivel === 'resaltada'))

  const idBase = `nvpc-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const mx = (nx: number) => nx * mundo.ancho
  const my = (ny: number) => ny * mundo.alto
  const anguloDe = (cam: DesignCamera) => {
    const s = sectors.find((x) => x.cameraId === cam.id)
    return s ? (s.startAngleRad + s.endAngleRad) / 2 : ((cam.yawDeg ?? 0) * Math.PI) / 180
  }

  const rotulos = coberturas
    .filter((c) => c.nivel === 'resaltada')
    .flatMap((c) => {
      const medio = (c.s.startAngleRad + c.s.endAngleRad) / 2
      const cx = px(c.s.cx)
      const cy = py(c.s.cy)
      const filas: { r: number; texto: string }[] = []
      const agrega = (norm: number, m: number) => {
        const r = norm * mundo.medio * vista.k
        // Sin rótulos encimados ni pegados al pin.
        if (!(m > 0) || r < 34 || filas.some((f) => Math.abs(f.r - r) < 36)) return
        filas.push({ r, texto: formatLength(m, unitSystem) })
      }
      agrega(c.zonas.alcanceNorm, c.zonas.alcanceM)
      // «Reconocer» solo existe en la gama de verde; el semáforo no lo pinta.
      if (paleta === 'tonos') agrega(c.zonas.reconocerNorm, c.zonas.reconocerM)
      agrega(c.zonas.identificarNorm, c.zonas.identificarM)
      return filas.map((f) => ({
        key: `${c.s.cameraId}-${c.s.lensId ?? 'main'}-${f.texto}`,
        x: cx + Math.cos(medio) * (f.r - 13),
        y: cy + Math.sin(medio) * (f.r - 13),
        texto: f.texto,
      }))
    })

  const filtroPlano = imagen?.tinta.oscuro
    ? undefined
    : // Más contraste lleva el papel a negro puro (se funde con el fondo); luego se
      // baja un poco el brillo para que los muros no encandilen.
      'invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.88)'

  return (
    <div
      ref={marcoRef}
      data-nv-plano-cliente
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ background: FONDO, cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={planoUrl}
        alt=""
        draggable={false}
        data-nv-plano-imagen={imagen?.tinta.oscuro ? 'oscuro' : 'invertido'}
        style={{
          position: 'absolute',
          // En porcentajes del marco: al imprimir escala con él.
          left: pct(vista.x, marcoW),
          top: pct(vista.y, marcoH),
          width: pct(mundo.ancho * vista.k, marcoW),
          height: pct(mundo.alto * vista.k, marcoH),
          maxWidth: 'none',
          filter: filtroPlano,
          // El papel (negro tras invertir) toma el color del fondo: sin recuadro.
          mixBlendMode: imagen?.tinta.oscuro ? 'normal' : 'screen',
          pointerEvents: 'none',
        }}
      />
      <svg
        viewBox={`0 0 ${Math.max(1, marcoW)} ${Math.max(1, marcoH)}`}
        preserveAspectRatio="none"
        className="absolute left-0 top-0 h-full w-full"
        style={{ pointerEvents: 'none' }}
        role="img"
        aria-label="Plano con la ubicación y el alcance de las cámaras"
      >
        <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
          {paleta === 'semaforo'
            ? (['fondo', 'elegida'] as const).map((capa) => {
                // Las bandas del semáforo del editor, en verde / naranja / amarillo. Dentro de la
                // capa los colores son sólidos y el verde tapa al naranja y al amarillo;
                // la transparencia se aplica a la capa entera: así dos conos que se
                // cruzan no se oscurecen ni se ensucian, y el plano se ve debajo.
                const lista = coberturas.filter((c) => (c.nivel === 'resaltada') === (capa === 'elegida'))
                if (lista.length === 0) return null
                const puntos = (poly?: { x: number; y: number }[]) =>
                  poly?.length
                    ? poly.map((q) => `${mx(q.x).toFixed(1)},${my(q.y).toFixed(1)}`).join(' ')
                    : null
                const opacidad =
                  capa === 'elegida'
                    ? SEMAFORO_CLIENTE_OPACIDAD + 0.14
                    : hayAislada
                      ? SEMAFORO_CLIENTE_OPACIDAD * 0.4
                      : SEMAFORO_CLIENTE_OPACIDAD
                return (
                  <g key={capa} data-nv-semaforo={capa} opacity={opacidad}>
                    {(['red', 'yellow', 'green'] as const).flatMap((banda) =>
                      lista.map((c) => {
                        const pts = puntos(
                          banda === 'red'
                            ? c.s.redPolygon
                            : banda === 'yellow'
                              ? c.s.yellowPolygon
                              : c.s.greenPolygon,
                        )
                        return pts ? (
                          <polygon
                            key={`${banda}-${c.s.cameraId}-${c.s.lensId ?? 'main'}`}
                            data-nv-banda={banda}
                            points={pts}
                            fill={SEMAFORO_CLIENTE_HEX[banda]}
                          />
                        ) : null
                      }),
                    )}
                  </g>
                )
              })
            : null}

          {coberturas.map(({ s, nivel, i, zonas }) => {
            const clip = `${idBase}-${i}`
            const cx = mx(s.cx)
            const cy = my(s.cy)
            const poligono = s.polygon?.length
              ? s.polygon.map((p) => `${mx(p.x).toFixed(1)},${my(p.y).toFixed(1)}`).join(' ')
              : null
            const cuna = cunaDeSector(cx, cy, s.radiusNorm * mundo.medio, s.startAngleRad, s.endAngleRad)
            const forma = (props: FormaProps) =>
              poligono ? <polygon points={poligono} {...props} /> : <path d={cuna} {...props} />
            const borde = paleta === 'semaforo' ? '#f1f5f9' : '#a7f3d0'
            const contorno =
              nivel === 'resaltada'
                ? forma({
                    fill: 'none',
                    stroke: borde,
                    strokeWidth: 1.3,
                    strokeDasharray: '5 4',
                    vectorEffect: 'non-scaling-stroke',
                  })
                : null
            if (paleta === 'semaforo') {
              // Las bandas se pintan aparte (capas aplanadas, más abajo); aquí solo
              // va el contorno de la cámara elegida.
              return (
                <g
                  key={`${s.cameraId}-${s.lensId ?? 'main'}`}
                  data-nv-cobertura={nivel}
                  data-nv-cobertura-paleta="semaforo"
                >
                  {contorno}
                </g>
              )
            }
            return (
              <g
                key={`${s.cameraId}-${s.lensId ?? 'main'}`}
                data-nv-cobertura={nivel}
                data-nv-cobertura-paleta="tonos"
                opacity={nivel === 'resaltada' ? 1 : nivel === 'normal' ? 0.78 : 0.26}
              >
                <clipPath id={clip}>{forma({})}</clipPath>
                <g clipPath={`url(#${clip})`} fill={PLANO_CLIENTE_TONO}>
                  {forma({ fillOpacity: 0.1 })}
                  <circle cx={cx} cy={cy} r={zonas.reconocerNorm * mundo.medio} fillOpacity={0.14} />
                  <circle cx={cx} cy={cy} r={zonas.identificarNorm * mundo.medio} fillOpacity={0.26} />
                  {nivel === 'resaltada' ? (
                    <g fill="none" stroke="#a7f3d0" strokeWidth={1.3}>
                      <circle cx={cx} cy={cy} r={zonas.reconocerNorm * mundo.medio} vectorEffect="non-scaling-stroke" />
                      <circle cx={cx} cy={cy} r={zonas.identificarNorm * mundo.medio} vectorEffect="non-scaling-stroke" />
                    </g>
                  ) : null}
                </g>
                {contorno}
              </g>
            )
          })}

          {structures.map((st) => (
            <line
              key={st.id}
              x1={mx(st.x1)}
              y1={my(st.y1)}
              x2={mx(st.x2)}
              y2={my(st.y2)}
              stroke="#a7b6b0"
              strokeOpacity={0.7}
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {verCables
            ? cableRoutes.map((r) => (
                <polyline
                  key={r.id}
                  data-nv-cable={r.uplink ? 'troncal' : 'camara'}
                  points={r.points.map((p) => `${mx(p.x).toFixed(1)},${my(p.y).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke="#f5c84b"
                  strokeOpacity={0.85}
                  strokeWidth={r.uplink ? 2.4 : 1.5}
                  strokeDasharray={r.overLimit ? '7 5' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}
        </g>

        {planDevices.map((d) => (
          <circle key={d.id} cx={px(d.x)} cy={py(d.y)} r={4} fill="#8fa3b5" stroke={FONDO} strokeWidth={1.5} />
        ))}

        <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={10} fontWeight={700} textAnchor="middle">
          {networkNodes.map((n) => {
            const x = px(n.x)
            const y = py(n.y)
            if (n.kind === 'ap') {
              return (
                <g key={n.id} data-nv-red={n.kind}>
                  <title>{n.label}</title>
                  <circle cx={x} cy={y} r={12} fill={FONDO} stroke="#8fa3b5" strokeWidth={1.5} />
                  <path
                    d={`M${x - 7} ${y - 2}a10 10 0 0 1 14 0M${x - 4} ${y + 2}a6 6 0 0 1 8 0`}
                    fill="none"
                    stroke="#c3d2e0"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />
                  <circle cx={x} cy={y + 6} r={1.6} fill="#c3d2e0" />
                </g>
              )
            }
            const texto = ETIQUETA_RED[n.kind]
            const ancho = texto.length * 7 + 16
            return (
              <g key={n.id} data-nv-red={n.kind}>
                <title>{n.label}</title>
                <rect x={x - ancho / 2} y={y - 11} width={ancho} height={22} rx={5} fill={FONDO} stroke="#8fa3b5" strokeWidth={1.5} />
                <text x={x} y={y + 3.5} fill="#c3d2e0">
                  {texto}
                </text>
              </g>
            )
          })}
        </g>

        <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={11} fontWeight={700} textAnchor="middle">
          {cameras.map((cam, i) => {
            const x = px(cam.x)
            const y = py(cam.y)
            const elegida = cam.id === selectedId
            const apagada = hiddenIds.includes(cam.id) && !elegida
            const forma = getCameraModelOrDefault(cam.modelId).formFactor
            const relleno = elegida ? PLANO_CLIENTE_TONO : FONDO
            const borde = elegida ? '#ffffff' : TINTA
            const comun = { fill: relleno, stroke: borde, strokeWidth: 2 }
            return (
              <g
                key={cam.id}
                data-nv-pin={cam.id}
                data-nv-pin-forma={forma}
                data-nv-pin-elegida={elegida ? '' : undefined}
                opacity={apagada ? 0.6 : 1}
              >
                <title>{cam.label}</title>
                {elegida ? (
                  <circle cx={x} cy={y} r={RADIO_PIN + 9} fill="none" stroke={PLANO_CLIENTE_TONO} strokeWidth={2} opacity={0.6} />
                ) : null}
                <polygon points={cunaDeDireccion(x, y, anguloDe(cam), RADIO_PIN)} fill={borde} />
                {forma === 'ptz' ? (
                  <polygon points={hexagono(x, y, RADIO_PIN + 2)} {...comun} />
                ) : forma === 'bullet' ? (
                  <rect x={x - RADIO_PIN} y={y - RADIO_PIN + 2} width={RADIO_PIN * 2} height={RADIO_PIN * 2 - 4} rx={6} {...comun} />
                ) : (
                  <circle cx={x} cy={y} r={RADIO_PIN} {...comun} />
                )}
                <text x={x} y={y + 4} fill={elegida ? '#06110d' : TINTA}>
                  {numeroDePin(cam.label, i)}
                </text>
                {splitterDeCamara(cam) ? (
                  <rect
                    data-nv-pin-splitter
                    x={x + RADIO_PIN - 4}
                    y={y + RADIO_PIN - 4}
                    width={9}
                    height={9}
                    rx={2.5}
                    fill="#ffb000"
                    stroke={FONDO}
                    strokeWidth={1.5}
                  />
                ) : null}
              </g>
            )
          })}
        </g>

        <g
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={11}
          fontWeight={700}
          textAnchor="middle"
          fill="#ecfff5"
          stroke={FONDO}
          strokeWidth={3.5}
          paintOrder="stroke"
        >
          {rotulos.map((r) => (
            <text key={r.key} data-nv-plano-distancia x={r.x} y={r.y + 4}>
              {r.texto}
            </text>
          ))}
        </g>
      </svg>

      <div
        data-nv-plano-control
        className="nv-no-print absolute right-2 top-2 flex items-center gap-1.5 print:hidden"
        style={{ cursor: 'default' }}
      >
        <button
          type="button"
          aria-label="Acercar"
          onClick={() => zoomCentro(1.35)}
          className="grid h-11 w-11 place-items-center border border-[#2e7d54] bg-[#07110d]/90 text-lg font-bold text-[#d6ffe5]"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Alejar"
          onClick={() => zoomCentro(1 / 1.35)}
          className="grid h-11 w-11 place-items-center border border-[#2e7d54] bg-[#07110d]/90 text-lg font-bold text-[#d6ffe5]"
        >
          −
        </button>
        <button
          type="button"
          data-nv-plano-ajustar
          onClick={ajustar}
          className="h-11 border border-[#2e7d54] bg-[#07110d]/90 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d6ffe5]"
        >
          Ajustar
        </button>
      </div>
    </div>
  )
}
