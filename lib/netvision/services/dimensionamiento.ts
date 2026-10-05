/**
 * Dimensionamiento del sistema de CCTV:
 *  - Grabación: TB necesarios para los días pedidos y si el grabador y el disco alcanzan.
 *  - UPS: consumo total y capacidad recomendada para los minutos de respaldo pedidos.
 *  - Distancia útil por cámara: hasta dónde identifica un rostro, reconoce a una
 *    persona o solo detecta presencia, según resolución y ángulo (EN 62676-4).
 *
 * Son estimaciones a partir de la ficha técnica; no sustituyen una prueba en sitio.
 */
import { effectiveCameraLenses, getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
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
} from '@/lib/netvision/types'

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
  const camaras = cameras.length
  const mbps = redondear1(totalBandwidthMbps([...cameras]))
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
  if (camaras === 0) {
    avisos.push({ nivel: 'info', texto: 'Coloca cámaras en el plano para calcular la grabación.' })
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
  const wCamaras = cameras.reduce((s, c) => s + getCameraModelOrDefault(c.modelId).poeWatts, 0)
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

/** Píxeles por metro que exige la norma EN 62676-4 para cada tarea. */
export const DENSIDAD_PX_POR_M = {
  identificar: 250,
  reconocer: 125,
  detectar: 25,
} as const

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
 * Distancia (m) a la que la imagen todavía tiene `pxPorM` píxeles por metro:
 * ancho de escena = 2 · d · tan(ángulo/2)  →  d = píxeles / (2 · pxPorM · tan(ángulo/2)).
 */
export function distanciaParaDensidad(
  pixelesAncho: number,
  fovDeg: number,
  pxPorM: number,
): number {
  if (!(pixelesAncho > 0) || !(pxPorM > 0) || !(fovDeg > 0)) return 0
  const fov = Math.min(170, fovDeg)
  const d = pixelesAncho / (2 * pxPorM * Math.tan((fov * Math.PI) / 360))
  return redondear1(d)
}

export type AlcanceUtilLente = {
  lensId: string
  /** Nombre de la lente (solo relevante en cámaras de dos lentes). */
  etiqueta: string
  fovDeg: number
  identificarM: number
  reconocerM: number
  detectarM: number
}

export type AlcanceUtilCamara = {
  resolucion: string
  pixelesAncho: number
  lentes: AlcanceUtilLente[]
  /** Alcance de noche de la ficha (infrarrojo / luz propia). */
  nocheM: number
}

/** Distancias útiles de una cámara del plano, con su ángulo actual (ajustado o de ficha). */
export function alcanceUtilCamara(cam: DesignCamera): AlcanceUtilCamara {
  const model = getCameraModelOrDefault(cam.modelId)
  const pixelesAncho = pixelesHorizontales(model.resolution)
  const lentes = effectiveCameraLenses(cam, 'day').map((l) => ({
    lensId: l.lensId,
    etiqueta: l.label,
    fovDeg: Math.round(l.fovDeg),
    identificarM: distanciaParaDensidad(pixelesAncho, l.fovDeg, DENSIDAD_PX_POR_M.identificar),
    reconocerM: distanciaParaDensidad(pixelesAncho, l.fovDeg, DENSIDAD_PX_POR_M.reconocer),
    // Detectar no pasa del alcance de día que da la ficha del fabricante.
    detectarM: Math.min(
      distanciaParaDensidad(pixelesAncho, l.fovDeg, DENSIDAD_PX_POR_M.detectar),
      l.catalogRangeM,
    ),
  }))
  return { resolucion: model.resolution, pixelesAncho, lentes, nocheM: model.rangeNightM }
}

/**
 * Resumen de una línea para la ficha del cliente. En cámaras de dos lentes usa
 * la que llega más lejos (la tele), que es con la que se identifica.
 */
export function resumenAlcanceUtil(alcance: AlcanceUtilCamara): string {
  const l = alcance.lentes.reduce<AlcanceUtilLente | null>(
    (mejor, x) => (!mejor || x.identificarM > mejor.identificarM ? x : mejor),
    null,
  )
  if (!l) return ''
  return `Identifica rostros hasta ${l.identificarM} m · reconoce personas hasta ${l.reconocerM} m`
}
