/**
 * Dimensionamiento del sistema de CCTV:
 *  - Grabación: TB necesarios para los días pedidos y si el grabador y el disco alcanzan.
 *  - UPS: consumo total y capacidad recomendada para los minutos de respaldo pedidos.
 *  - Distancia útil por cámara: hasta dónde identifica un rostro, reconoce a una
 *    persona o solo detecta presencia, según la óptica real de la lente
 *    (EN 62676-4 / tabla DORI del fabricante) y la altura de montaje.
 *
 * Son estimaciones a partir de la ficha técnica; no sustituyen una prueba en sitio.
 */
import {
  camarasCableadas,
  getCameraModelOrDefault,
  lenteElegida,
} from '@/lib/netvision/catalog/cameras'
import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import {
  HDD_CAPACITIES_TB,
  clampHddTb,
  getInfraModelOrDefault,
} from '@/lib/netvision/catalog/salaTecnica'
import { estimateStorageTb, totalBandwidthMbps } from '@/lib/netvision/services/bandwidthCalculator'
import type {
  DesignCamera,
  DesignInfraDevice,
  DesignNetworkNode,
  UnitSystem,
} from '@/lib/netvision/types'
import { formatLength } from '@/lib/netvision/utils/units'

export const DIAS_GRABACION_DEFECTO = 30
export const DIAS_GRABACION_MAX = 365
export const RESPALDO_UPS_MIN_DEFECTO = 30
export const RESPALDO_UPS_MIN_MAX = 480

export type NivelAviso = 'ok' | 'falta' | 'info'
export type AvisoDimension = { nivel: NivelAviso; texto: string }

const redondear1 = (n: number) => Math.round(n * 10) / 10

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

export function acotarDiasGrabacion(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DIAS_GRABACION_DEFECTO
  return Math.min(DIAS_GRABACION_MAX, Math.max(1, Math.round(n)))
}

export function acotarRespaldoMin(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return RESPALDO_UPS_MIN_DEFECTO
  return Math.min(RESPALDO_UPS_MIN_MAX, Math.max(5, Math.round(n)))
}

// ───────────────────────────── Grabación ─────────────────────────────

/** Tamaños comerciales de grabador (canales). */
export const TAMANOS_GRABADOR_CANALES = [4, 8, 16, 32, 64] as const

/** Grabador comercial más pequeño que cubre las cámaras. */
export function canalesRecomendados(camaras: number): number {
  if (camaras <= 0) return 0
  for (const c of TAMANOS_GRABADOR_CANALES) if (c >= camaras) return c
  return Math.ceil(camaras / 64) * 64
}

/**
 * Discos comerciales para cubrir los TB pedidos: uno solo si existe ese tamaño;
 * si no, varios iguales (p. ej. 30 TB → 2 × 16 TB).
 */
export function discosRecomendados(tbNecesarios: number): number[] {
  if (!(tbNecesarios > 0)) return []
  const mayor = HDD_CAPACITIES_TB[HDD_CAPACITIES_TB.length - 1]!
  const cantidad = Math.max(1, Math.ceil(tbNecesarios / mayor))
  const porDisco = tbNecesarios / cantidad
  const tamano = HDD_CAPACITIES_TB.find((tb) => tb >= porDisco) ?? mayor
  return Array.from({ length: cantidad }, () => tamano)
}

/** Canales de un grabador: los declarados o, si faltan, sus puertos. */
function canalesDeGrabador(node: DesignNetworkNode): number {
  const m = getNetworkModelOrDefault(node.modelId, 'nvr')
  return typeof m.channels === 'number' && m.channels > 0 ? m.channels : m.ports
}

export type DimGrabacion = {
  camaras: number
  dias: number
  mbps: number
  tbPorDia: number
  tbNecesarios: number
  discosRecomendados: number[]
  tbColocados: number
  discosColocados: number
  /** Días que alcanzan los discos colocados; null si no hay discos o cámaras. */
  diasConLoColocado: number | null
  grabadores: number
  canalesColocados: number
  canalesRecomendados: number
  bahias: number
  avisos: AvisoDimension[]
}

export function dimensionarGrabacion(
  cameras: readonly DesignCamera[],
  networkNodes: readonly DesignNetworkNode[],
  infraDevices: readonly DesignInfraDevice[],
  diasRaw: unknown,
): DimGrabacion {
  const dias = acotarDiasGrabacion(diasRaw)
  // Por Wi‑Fi o batería graban en su propia memoria o en la nube.
  const grabadas = camarasCableadas(cameras)
  const sinGrabador = cameras.length - grabadas.length
  const camaras = grabadas.length
  const mbps = redondear1(totalBandwidthMbps(grabadas))
  const tbExactoPorDia = estimateStorageTb(mbps, 1)
  const tbNecesarios = Math.ceil(estimateStorageTb(mbps, dias) * 10) / 10

  const discos = infraDevices.filter((d) => d.kind === 'hdd')
  const tbColocados = discos.reduce((s, d) => {
    const model = getInfraModelOrDefault(d.modelId, 'hdd')
    return s + clampHddTb(d.capacityTb ?? model.capacityTb)
  }, 0)
  const grabadoresNodos = networkNodes.filter((n) => n.kind === 'nvr')
  const canalesColocados = grabadoresNodos.reduce((s, n) => s + canalesDeGrabador(n), 0)
  const bahias = grabadoresNodos.reduce(
    (s, n) => s + (getNetworkModelOrDefault(n.modelId, 'nvr').hddBays ?? 0),
    0,
  )
  const diasConLoColocado =
    discos.length > 0 && tbExactoPorDia > 0 ? Math.floor(tbColocados / tbExactoPorDia) : null
  const recomendados = discosRecomendados(tbNecesarios)
  const textoDiscos = (lista: number[]) =>
    lista.length === 0
      ? ''
      : lista.length === 1
        ? `un disco de ${lista[0]} TB`
        : `${lista.length} discos de ${lista[0]} TB`

  const avisos: AvisoDimension[] = []
  if (sinGrabador > 0) {
    avisos.push({
      nivel: 'info',
      texto: `${plural(sinGrabador, 'cámara va', 'cámaras van')} por Wi‑Fi o batería: ${sinGrabador === 1 ? 'graba' : 'graban'} en su memoria o en la nube y no se ${sinGrabador === 1 ? 'cuenta' : 'cuentan'} en el grabador ni en el UPS.`,
    })
  }
  if (camaras === 0) {
    if (sinGrabador === 0) {
      avisos.push({ nivel: 'info', texto: 'Coloca cámaras en el plano para calcular la grabación.' })
    }
  } else {
    // Grabador y canales
    if (grabadoresNodos.length === 0) {
      avisos.push({
        nivel: 'falta',
        texto: `Falta el grabador: ${plural(camaras, 'cámara necesita', 'cámaras necesitan')} uno de ${canalesRecomendados(camaras)} canales o más.`,
      })
    } else if (canalesColocados < camaras) {
      const faltan = camaras - canalesColocados
      avisos.push({
        nivel: 'falta',
        texto: `El grabador tiene ${plural(canalesColocados, 'canal', 'canales')} y hay ${plural(camaras, 'cámara', 'cámaras')}: ${faltan === 1 ? 'falta 1 canal' : `faltan ${faltan} canales`}. Usa uno de ${canalesRecomendados(camaras)} canales.`,
      })
    } else {
      avisos.push({
        nivel: 'ok',
        texto: `Grabador: ${plural(canalesColocados, 'canal', 'canales')} para ${plural(camaras, 'cámara', 'cámaras')}.`,
      })
    }

    // Disco
    if (discos.length === 0) {
      avisos.push({
        nivel: 'falta',
        texto: `Falta el disco: para ${plural(dias, 'día', 'días')} hacen falta ${tbNecesarios} TB (${textoDiscos(recomendados)}).`,
      })
    } else if (tbColocados + 1e-9 < tbNecesarios) {
      avisos.push({
        nivel: 'falta',
        texto: `Disco de ${tbColocados} TB: alcanza para ${plural(diasConLoColocado ?? 0, 'día', 'días')}, no para ${dias}. Hacen falta ${tbNecesarios} TB (${textoDiscos(recomendados)}).`,
      })
    } else {
      avisos.push({
        nivel: 'ok',
        texto: `Disco de ${tbColocados} TB: alcanza para ${plural(diasConLoColocado ?? dias, 'día', 'días')} (pediste ${dias}).`,
      })
    }

    // Bahías
    if (grabadoresNodos.length > 0 && bahias > 0 && discos.length > bahias) {
      avisos.push({
        nivel: 'falta',
        texto: `Hay ${plural(discos.length, 'disco', 'discos')} y el grabador solo tiene ${plural(bahias, 'bahía', 'bahías')}.`,
      })
    } else if (
      grabadoresNodos.length > 0 &&
      bahias > 0 &&
      discos.length === 0 &&
      recomendados.length > bahias
    ) {
      avisos.push({
        nivel: 'info',
        texto: `Para ${tbNecesarios} TB hacen falta ${plural(recomendados.length, 'disco', 'discos')} y el grabador tiene ${plural(bahias, 'bahía', 'bahías')}: usa un grabador con más bahías.`,
      })
    }
  }

  return {
    camaras,
    dias,
    mbps,
    tbPorDia: Math.round(tbExactoPorDia * 1000) / 1000,
    tbNecesarios,
    discosRecomendados: recomendados,
    tbColocados,
    discosColocados: discos.length,
    diasConLoColocado: camaras > 0 ? diasConLoColocado : null,
    grabadores: grabadoresNodos.length,
    canalesColocados,
    canalesRecomendados: canalesRecomendados(camaras),
    bahias,
    avisos,
  }
}

// ──────────────────────────────── UPS ────────────────────────────────

/** Capacidades comerciales de UPS (VA). */
export const TAMANOS_UPS_VA = [600, 1000, 1500, 2200, 3000] as const
/** Un UPS de oficina entrega en vatios ~60 % de sus VA. */
export const UPS_FACTOR_POTENCIA = 0.6
/** Se dimensiona para trabajar al 80 % como máximo. */
export const UPS_CARGA_MAX = 0.8
/** Parte de la batería que de verdad se aprovecha (inversor, descarga rápida, desgaste). */
export const UPS_BATERIA_UTIL = 0.5
/** Consumo aproximado de un disco de vigilancia de 3,5". */
export const DISCO_WATTS = 8

export function upsRecomendadoVa(vaMinimo: number): number {
  if (!(vaMinimo > 0)) return 0
  for (const va of TAMANOS_UPS_VA) if (va >= vaMinimo) return va
  const mayor = TAMANOS_UPS_VA[TAMANOS_UPS_VA.length - 1]!
  return Math.ceil(vaMinimo / mayor) * mayor
}

export type DimUps = {
  minutos: number
  wCamaras: number
  wRed: number
  wGrabadores: number
  wDiscos: number
  wTotal: number
  vaMinimo: number
  vaRecomendado: number
  /** Energía de batería necesaria para los minutos pedidos (Wh). */
  whBateria: number
  /** Lo mismo expresado en Ah de batería de 12 V. */
  ahBateria12v: number
  upsColocados: number
  vaColocado: number
  avisos: AvisoDimension[]
}

export function dimensionarUps(
  cameras: readonly DesignCamera[],
  networkNodes: readonly DesignNetworkNode[],
  infraDevices: readonly DesignInfraDevice[],
  minutosRaw: unknown,
): DimUps {
  const minutos = acotarRespaldoMin(minutosRaw)
  // Al UPS del rack solo le cargan las cámaras alimentadas por el cable de red.
  const wCamaras = camarasCableadas(cameras).reduce(
    (s, c) => s + getCameraModelOrDefault(c.modelId).poeWatts,
    0,
  )
  let wRed = 0
  let wGrabadores = 0
  for (const n of networkNodes) {
    const w = getNetworkModelOrDefault(n.modelId, n.kind).drawWatts
    if (n.kind === 'nvr') wGrabadores += w
    else wRed += w
  }
  const wDiscos = infraDevices.filter((d) => d.kind === 'hdd').length * DISCO_WATTS
  const wTotal = redondear1(wCamaras + wRed + wGrabadores + wDiscos)

  const vaMinimo = Math.ceil(wTotal / UPS_FACTOR_POTENCIA / UPS_CARGA_MAX)
  const vaRecomendado = upsRecomendadoVa(vaMinimo)
  const whBateria = Math.ceil((wTotal * (minutos / 60)) / UPS_BATERIA_UTIL)
  const ahBateria12v = Math.ceil(whBateria / 12)

  const upsLista = infraDevices.filter((d) => d.kind === 'ups')
  const vaColocado = upsLista.reduce(
    (s, d) => s + (getInfraModelOrDefault(d.modelId, 'ups').va ?? 0),
    0,
  )

  const avisos: AvisoDimension[] = []
  if (!(wTotal > 0)) {
    avisos.push({ nivel: 'info', texto: 'Coloca cámaras y equipos para calcular el UPS.' })
  } else {
    if (upsLista.length === 0) {
      avisos.push({
        nivel: 'falta',
        texto: `Falta el UPS: para ${wTotal} W se recomienda uno de ${vaRecomendado} VA o más.`,
      })
    } else if (vaColocado < vaMinimo) {
      avisos.push({
        nivel: 'falta',
        texto: `El UPS de ${vaColocado} VA queda corto para ${wTotal} W: usa uno de ${vaRecomendado} VA o más.`,
      })
    } else {
      avisos.push({
        nivel: 'ok',
        texto: `UPS de ${vaColocado} VA: soporta la carga de ${wTotal} W.`,
      })
    }
    avisos.push({
      nivel: 'info',
      texto: `Para ${minutos} min de respaldo hacen falta unos ${whBateria} Wh de batería (≈ ${ahBateria12v} Ah a 12 V). Compara con la autonomía de la ficha del UPS; si no alcanza, sube de modelo o agrega batería externa.`,
    })
  }

  return {
    minutos,
    wCamaras: redondear1(wCamaras),
    wRed: redondear1(wRed),
    wGrabadores: redondear1(wGrabadores),
    wDiscos,
    wTotal,
    vaMinimo,
    vaRecomendado,
    whBateria,
    ahBateria12v,
    upsColocados: upsLista.length,
    vaColocado,
    avisos,
  }
}

// ───────────────────── Distancia útil por cámara ─────────────────────
//
// Qué se calcula: la distancia a la que la imagen todavía tiene los píxeles por
// metro que pide la norma EN 62676-4 (tabla DORI de los fabricantes):
//   identificar 250 px/m · reconocer 125 px/m · detectar 25 px/m.
//
// De qué depende: SOLO de la óptica — ancho de imagen en píxeles y ángulo
// horizontal real de la lente. Recortar el cono en el plano NO cambia la lente,
// así que no cambia estas distancias; lo que las cambia es elegir otra lente
// (2.8 / 4 / 6 mm) u otro modelo.
//
// De dónde sale el número:
//   1. Si el fabricante publica su tabla DORI para esa lente (Hikvision), se
//      usa su distancia de detección y las demás salen en proporción.
//   2. Si no (Ezviz, Aqara…), se calcula con la densidad angular de la lente:
//        px por metro a la distancia d = ancho_px / (ángulo_en_radianes · d)
//      Reproduce las tablas de Hikvision con un 5–15 % de margen a favor del
//      cliente y no se dispara con lentes de 150–170° (timbres).
//
// Después se pasa al piso: la cámara está a cierta altura y el rostro a ~1,6 m,
// así que la distancia sobre el suelo es menor que la distancia en línea recta.

/** Píxeles por metro que exige la norma EN 62676-4 para cada tarea. */
export const DENSIDAD_PX_POR_M = {
  identificar: 250,
  reconocer: 125,
  detectar: 25,
} as const

/** Altura a la que se mide un rostro de pie (m). */
export const ALTURA_ROSTRO_M = 1.6
/** Por encima de este ángulo la cámara ve la coronilla más que la cara. */
export const ANGULO_ROSTRO_MAX_DEG = 30

/** Ancho de imagen en píxeles a partir del texto de resolución del catálogo. */
export function pixelesHorizontales(resolucion: string): number {
  const r = (resolucion ?? '').toUpperCase()
  if (/4K|8\s*MP|2160/.test(r)) return 3840
  if (/3K/.test(r)) return 2880
  if (/5\s*MP/.test(r)) return 2592
  if (/QHD|2K\+|4\s*MP|1440/.test(r)) return 2560
  if (/2K|3\s*MP|1296/.test(r)) return 2304
  if (/1080|2\s*MP|FHD/.test(r)) return 1920
  if (/720/.test(r)) return 1280
  const mp = /(\d+(?:\.\d+)?)\s*MP/.exec(r)
  if (mp) return Math.round(Math.sqrt((Number(mp[1]) * 1e6 * 16) / 9))
  return 1920
}

/**
 * Distancia en línea recta (m) a la que la imagen aún tiene `pxPorM` píxeles
 * por metro, con la densidad angular de la lente:
 *   d = ancho_px / (pxPorM · ángulo_horizontal_en_radianes)
 */
export function distanciaParaDensidad(
  pixelesAncho: number,
  fovDeg: number,
  pxPorM: number,
): number {
  if (!(pixelesAncho > 0) || !(pxPorM > 0) || !(fovDeg > 0)) return 0
  const fovRad = (Math.min(360, fovDeg) * Math.PI) / 180
  return pixelesAncho / (pxPorM * fovRad)
}

/**
 * Distancia sobre el piso para una distancia en línea recta, con la cámara a
 * `alturaM` y el objetivo (el rostro) a `ALTURA_ROSTRO_M`. 0 si no alcanza.
 */
export function distanciaEnPiso(rectaM: number, alturaM: number): number {
  const desnivel = Math.max(0, alturaM - ALTURA_ROSTRO_M)
  if (!(rectaM - desnivel > 1e-6)) return 0
  return Math.sqrt(rectaM * rectaM - desnivel * desnivel)
}

export type AlcanceUtilLente = {
  lensId: string
  /** Nombre de la lente (solo relevante en cámaras de dos lentes). */
  etiqueta: string
  /** Ángulo horizontal real de la lente (no el cono recortado en el plano). */
  fovDeg: number
  focalMm: number | null
  pixelesAncho: number
  /** Distancias sobre el piso, de día, a la altura de montaje de la cámara. */
  identificarM: number
  reconocerM: number
  detectarM: number
  /** Alcance de la luz propia de noche (infrarrojo o luz blanca). */
  nocheM: number
  /** `fabricante`: tabla DORI de la ficha. `calculo`: resolución y ángulo. */
  fuente: 'fabricante' | 'calculo'
  /** Ángulo con que se ve el rostro en el límite de identificación (0 = de frente). */
  anguloRostroDeg: number
  /** Advertencia de montaje (altura), o null. */
  aviso: string | null
}

export type AlcanceUtilCamara = {
  resolucion: string
  alturaM: number
  lentes: AlcanceUtilLente[]
}

const redondearDist = (m: number) => Math.round(m * 10) / 10

function alcanceDeLente(args: {
  lensId: string
  etiqueta: string
  fovDeg: number
  focalMm: number | null
  pixelesAncho: number
  doriDetectM?: number
  nocheM: number
  alturaM: number
}): AlcanceUtilLente {
  const detectarRecta =
    typeof args.doriDetectM === 'number' && args.doriDetectM > 0
      ? args.doriDetectM
      : distanciaParaDensidad(args.pixelesAncho, args.fovDeg, DENSIDAD_PX_POR_M.detectar)
  // Las tres distancias guardan la proporción de sus densidades (25 : 125 : 250).
  const recta = (pxPorM: number) => (detectarRecta * DENSIDAD_PX_POR_M.detectar) / pxPorM
  const identificarRecta = recta(DENSIDAD_PX_POR_M.identificar)
  const identificarM = distanciaEnPiso(identificarRecta, args.alturaM)
  const desnivel = Math.max(0, args.alturaM - ALTURA_ROSTRO_M)
  const anguloRostroDeg =
    identificarM > 0 ? Math.round((Math.atan2(desnivel, identificarM) * 180) / Math.PI) : 90

  let aviso: string | null = null
  if (identificarM === 0) {
    aviso = `A ${redondearDist(args.alturaM)} m de altura no llega a identificar rostros: móntala más baja o usa una lente de más milímetros.`
  } else if (anguloRostroDeg > ANGULO_ROSTRO_MAX_DEG) {
    aviso = `A ${redondearDist(args.alturaM)} m de altura ve los rostros desde arriba (${anguloRostroDeg}°): identifica mejor montada más baja o con una lente de más milímetros.`
  }

  return {
    lensId: args.lensId,
    etiqueta: args.etiqueta,
    fovDeg: Math.round(args.fovDeg),
    focalMm: args.focalMm,
    pixelesAncho: args.pixelesAncho,
    identificarM: redondearDist(identificarM),
    reconocerM: redondearDist(distanciaEnPiso(recta(DENSIDAD_PX_POR_M.reconocer), args.alturaM)),
    detectarM: redondearDist(distanciaEnPiso(detectarRecta, args.alturaM)),
    nocheM: args.nocheM,
    fuente: typeof args.doriDetectM === 'number' && args.doriDetectM > 0 ? 'fabricante' : 'calculo',
    anguloRostroDeg,
    aviso,
  }
}

/**
 * Distancias útiles de una cámara del plano según su óptica real: la lente
 * elegida (o la de ficha) y su altura de montaje. El recorte del cono en el
 * plano no interviene.
 */
export function alcanceUtilCamara(cam: DesignCamera): AlcanceUtilCamara {
  const model = getCameraModelOrDefault(cam.modelId)
  const anchoModelo = model.sensorWidthPx ?? pixelesHorizontales(model.resolution)
  const alturaM =
    typeof cam.mountHeightM === 'number' && cam.mountHeightM > 0 ? cam.mountHeightM : 2.8

  const dobles = (model.lenses ?? []).filter((l) => l && l.fovDeg > 0)
  let lentes: AlcanceUtilLente[]
  if (dobles.length >= 2) {
    lentes = dobles.map((l, i) =>
      alcanceDeLente({
        lensId: l.id || (i === 0 ? 'wide' : `lens-${i}`),
        etiqueta: l.label || (i === 0 ? 'Gran angular' : 'Tele'),
        fovDeg: l.fovDeg,
        focalMm: l.focalMm ?? null,
        pixelesAncho: l.sensorWidthPx ?? anchoModelo,
        nocheM: l.rangeNightM,
        alturaM,
      }),
    )
  } else {
    const lente = lenteElegida(model, cam)
    lentes = [
      alcanceDeLente({
        lensId: 'main',
        etiqueta: 'Óptica',
        fovDeg: lente?.fovDeg ?? model.fovDeg,
        focalMm: lente?.focalMm ?? model.focalMm ?? null,
        pixelesAncho: anchoModelo,
        doriDetectM: lente?.doriDetectM,
        nocheM: model.rangeNightM,
        alturaM,
      }),
    ]
  }
  return { resolucion: model.resolution, alturaM, lentes }
}

/** Lente con la que mejor se identifica (en cámaras de dos lentes, la tele). */
export function lentePrincipalAlcance(alcance: AlcanceUtilCamara): AlcanceUtilLente | null {
  return alcance.lentes.reduce<AlcanceUtilLente | null>(
    (mejor, x) => (!mejor || x.identificarM > mejor.identificarM ? x : mejor),
    null,
  )
}

/** Resumen de una línea para la ficha del cliente, en las unidades del proyecto. */
export function resumenAlcanceUtil(
  alcance: AlcanceUtilCamara,
  unitSystem: UnitSystem = 'metric',
): string {
  const l = lentePrincipalAlcance(alcance)
  if (!l) return ''
  const dist = (m: number) => formatLength(m, unitSystem, 1)
  const reconoce = `reconoce personas hasta ${dist(l.reconocerM)}`
  if (!(l.identificarM > 0)) return `A esta altura no identifica rostros · ${reconoce}`
  return `Identifica rostros hasta ${dist(l.identificarM)} · ${reconoce}`
}
