/**
 * Plano de la vista del cliente (presentación): cálculos puros, sin React ni
 * navegador, para poder probarlos.
 *
 * El plano se dibuja en un «mundo» de 1000 unidades de ancho y el alto que le
 * toque por la proporción de la imagen. Un punto del diseño (0–1) cae en
 * (x·ancho, y·alto) y un radio (0–1) vale radio·(ancho+alto)/2, igual que en
 * el editor: así un alcance en metros se ve como un círculo de verdad.
 */
import { alcanceUtilCamara } from '@/lib/netvision/services/dimensionamiento'
import type { CoverageSector, DesignCamera, ScaleCalibration } from '@/lib/netvision/types'
import { metersToNormRadius } from '@/lib/netvision/utils/geometryHelpers'

export const MUNDO_ANCHO = 1000

export type Mundo = { ancho: number; alto: number; medio: number }

/** Tamaño del mundo para una imagen de proporción alto/ancho. */
export function mundoDePlano(aspecto: number | null | undefined): Mundo {
  const a = typeof aspecto === 'number' && Number.isFinite(aspecto) && aspecto > 0 ? aspecto : 0.75
  const alto = MUNDO_ANCHO * a
  return { ancho: MUNDO_ANCHO, alto, medio: (MUNDO_ANCHO + alto) / 2 }
}

/** Número que va dentro del pin: «CAM-03» → «03»; sin número, su posición. */
export function numeroDePin(label: string, indice: number): string {
  const m = /(\d{1,3})\s*$/.exec(label.trim())
  const n = m ? Number(m[1]) : indice + 1
  return String(n).padStart(2, '0')
}

/** Tira del cliente: «Cam 1» … «Cam 16». */
export function etiquetaCamTactica(label: string, indice: number): string {
  const m = /(\d{1,3})\s*$/.exec(label.trim())
  const n = m ? Number(m[1]) : indice + 1
  return `Cam ${n}`
}

export type ZonasSector = {
  /** Radios en coordenadas 0–1 del plano, ya recortados al cono dibujado. */
  identificarNorm: number
  reconocerNorm: number
  alcanceNorm: number
  /** Distancias reales en metros (para rotular). */
  identificarM: number
  reconocerM: number
  alcanceM: number
}

const redondear1 = (n: number) => Math.round(n * 10) / 10

/**
 * Las tres zonas de una cámara para el cliente: detección de rostro
 * (identificar), de cuerpo (reconocer) y de movimiento (el resto del cono).
 * Las distancias salen de la óptica real de la cámara; nunca pasan del cono
 * dibujado en el plano.
 */
export function zonasDeSector(
  sector: Pick<CoverageSector, 'radiusNorm' | 'lensId'>,
  cam: DesignCamera,
  scale: Pick<ScaleCalibration, 'metersPerNormX' | 'metersPerNormY'>,
): ZonasSector {
  const alcance = alcanceUtilCamara(cam)
  const lente =
    (sector.lensId ? alcance.lentes.find((l) => l.lensId === sector.lensId) : undefined) ??
    alcance.lentes[0]
  const avgM = (scale.metersPerNormX + scale.metersPerNormY) / 2
  const alcanceNorm = Math.max(0, sector.radiusNorm)
  const alcanceM = redondear1(alcanceNorm * avgM)
  const aNorm = (m: number) =>
    Math.min(alcanceNorm, metersToNormRadius(Math.max(0, m), scale.metersPerNormX, scale.metersPerNormY))
  const identificarNorm = aNorm(lente?.identificarM ?? 0)
  const reconocerNorm = Math.max(identificarNorm, aNorm(lente?.reconocerM ?? 0))
  return {
    identificarNorm,
    reconocerNorm,
    alcanceNorm,
    identificarM: redondear1(Math.min(lente?.identificarM ?? 0, alcanceM)),
    reconocerM: redondear1(Math.min(lente?.reconocerM ?? 0, alcanceM)),
    alcanceM,
  }
}

export type Caja = { x0: number; y0: number; x1: number; y1: number }

/** Une cajas (0–1); `null` si no hay ninguna. */
export function unirCajas(cajas: readonly (Caja | null | undefined)[]): Caja | null {
  let out: Caja | null = null
  for (const c of cajas) {
    if (!c) continue
    out = out
      ? {
          x0: Math.min(out.x0, c.x0),
          y0: Math.min(out.y0, c.y0),
          x1: Math.max(out.x1, c.x1),
          y1: Math.max(out.y1, c.y1),
        }
      : { ...c }
  }
  return out
}

/** Caja (0–1) que contiene una lista de puntos. */
export function cajaDePuntos(puntos: readonly { x: number; y: number }[]): Caja | null {
  if (puntos.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of puntos) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  if (!Number.isFinite(x0)) return null
  return { x0, y0, x1, y1 }
}

export type TintaPlano = {
  /** Caja (0–1) del dibujo, sin los márgenes en blanco de la hoja. */
  caja: Caja | null
  /** true si el plano ya es oscuro (no hay que invertirlo). */
  oscuro: boolean
}

/**
 * Busca dónde está el dibujo dentro de la imagen del plano (muchas hojas PDF
 * traen medio folio en blanco) y si la imagen ya es oscura.
 * `rgba` son los píxeles de una miniatura (4 bytes por píxel).
 */
export function tintaDelPlano(rgba: ArrayLike<number>, ancho: number, alto: number): TintaPlano {
  if (!(ancho > 0) || !(alto > 0) || rgba.length < ancho * alto * 4) {
    return { caja: null, oscuro: false }
  }
  const lum = (i: number) => 0.2126 * rgba[i]! + 0.7152 * rgba[i + 1]! + 0.0722 * rgba[i + 2]!
  // Fondo = lo que hay en las esquinas.
  const esquinas = [0, ancho - 1, (alto - 1) * ancho, alto * ancho - 1].map((p) => lum(p * 4))
  const fondo = esquinas.sort((a, b) => a - b)[1]!
  let suma = 0
  const porFila = new Array<number>(alto).fill(0)
  const porColumna = new Array<number>(ancho).fill(0)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const l = lum((y * ancho + x) * 4)
      suma += l
      if (Math.abs(l - fondo) > 48) {
        porFila[y]! += 1
        porColumna[x]! += 1
      }
    }
  }
  const oscuro = suma / (ancho * alto) < 96
  // Una fila o columna cuenta si tiene algo más que motas sueltas.
  const minFila = Math.max(2, Math.round(ancho * 0.01))
  const minColumna = Math.max(2, Math.round(alto * 0.01))
  const primero = (v: number[], min: number) => v.findIndex((n) => n >= min)
  const ultimo = (v: number[], min: number) => {
    for (let i = v.length - 1; i >= 0; i--) if (v[i]! >= min) return i
    return -1
  }
  const fy0 = primero(porFila, minFila)
  const fy1 = ultimo(porFila, minFila)
  const fx0 = primero(porColumna, minColumna)
  const fx1 = ultimo(porColumna, minColumna)
  if (fy0 < 0 || fx0 < 0 || fy1 <= fy0 || fx1 <= fx0) return { caja: null, oscuro }
  return {
    caja: { x0: fx0 / ancho, y0: fy0 / alto, x1: (fx1 + 1) / ancho, y1: (fy1 + 1) / alto },
    oscuro,
  }
}

export type Vista = { k: number; x: number; y: number }

/**
 * Vista (escala y desplazamiento) que encaja una caja del plano en el marco,
 * centrada y con un margen. Sin caja, encaja el plano entero.
 */
export function encuadrar(
  caja: Caja | null,
  mundo: Mundo,
  marcoAncho: number,
  marcoAlto: number,
  margenPx = 28,
): Vista {
  if (!(marcoAncho > 0) || !(marcoAlto > 0)) return { k: 1, x: 0, y: 0 }
  const c = caja ?? { x0: 0, y0: 0, x1: 1, y1: 1 }
  const x0 = Math.max(0, Math.min(1, c.x0)) * mundo.ancho
  const y0 = Math.max(0, Math.min(1, c.y0)) * mundo.alto
  const w = Math.max(1, Math.max(0, Math.min(1, c.x1)) * mundo.ancho - x0)
  const h = Math.max(1, Math.max(0, Math.min(1, c.y1)) * mundo.alto - y0)
  const margen = Math.min(margenPx, marcoAncho / 6, marcoAlto / 6)
  const k = Math.min((marcoAncho - 2 * margen) / w, (marcoAlto - 2 * margen) / h)
  return {
    k,
    x: (marcoAncho - w * k) / 2 - x0 * k,
    y: (marcoAlto - h * k) / 2 - y0 * k,
  }
}

/** Límites de zoom respecto al plano entero encajado. */
export function limitesDeZoom(mundo: Mundo, marcoAncho: number, marcoAlto: number) {
  const entero = encuadrar(null, mundo, marcoAncho, marcoAlto, 0).k
  return { min: entero * 0.6, max: entero * 10, entero }
}

/** Acerca o aleja manteniendo fijo el punto de la pantalla (px, py). */
export function zoomEn(vista: Vista, factor: number, px: number, py: number, min: number, max: number): Vista {
  const k = Math.min(max, Math.max(min, vista.k * factor))
  const f = k / vista.k
  return { k, x: px - (px - vista.x) * f, y: py - (py - vista.y) * f }
}

/** Triángulo que marca hacia dónde mira la cámara, pegado al borde del pin. */
export function cunaDeDireccion(cx: number, cy: number, anguloRad: number, radioPin: number): string {
  const p = (a: number, r: number) =>
    `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`
  const abre = 0.5
  return `${p(anguloRad, radioPin + 10)} ${p(anguloRad - abre, radioPin + 1)} ${p(anguloRad + abre, radioPin + 1)}`
}

/** Hexágono (pin de las PTZ). */
export function hexagono(cx: number, cy: number, r: number): string {
  return [0, 60, 120, 180, 240, 300]
    .map((g) => {
      const a = (g * Math.PI) / 180
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`
    })
    .join(' ')
}

/** Cuña (sector circular) para cuando no hay polígono recortado por muros. */
export function cunaDeSector(
  cx: number,
  cy: number,
  r: number,
  inicioRad: number,
  finRad: number,
): string {
  const barrido = finRad - inicioRad
  if (barrido >= Math.PI * 2 - 1e-3) {
    return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
  }
  const x1 = cx + Math.cos(inicioRad) * r
  const y1 = cy + Math.sin(inicioRad) * r
  const x2 = cx + Math.cos(finRad) * r
  const y2 = cy + Math.sin(finRad) * r
  const grande = barrido > Math.PI ? 1 : 0
  return `M${cx.toFixed(1)} ${cy.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 ${grande} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z`
}
