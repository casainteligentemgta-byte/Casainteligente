/**
 * Detección de muros, puertas y ventanas con IA (visión) sobre la imagen del plano.
 * La IA devuelve segmentos en coordenadas 0–1000; aquí se limpian: se enderezan los casi
 * horizontales/verticales, se descartan los diminutos y se unen los tramos colineales.
 */
import type { DetectWallsResult } from '@/lib/netvision/detectWallsFromPdf'
import type { WallSegment } from '@/lib/netvision/utils/detectWallsGeometry'

export type TipoMuroIa = 'muro' | 'puerta' | 'ventana'
export type SegmentoIa = { x1: number; y1: number; x2: number; y2: number; tipo?: string }

/** Esquema de respuesta para Gemini (salida JSON estructurada). */
export const ESQUEMA_MUROS_IA = {
  type: 'object',
  properties: {
    muros: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          x1: { type: 'integer' },
          y1: { type: 'integer' },
          x2: { type: 'integer' },
          y2: { type: 'integer' },
          tipo: { type: 'string', enum: ['muro', 'puerta', 'ventana'] },
        },
        required: ['x1', 'y1', 'x2', 'y2', 'tipo'],
      },
    },
  },
  required: ['muros'],
} as const

export const PROMPT_MUROS_IA = `Eres un dibujante arquitectónico experto. La imagen es un plano de planta (puede ser un PDF exportado de CAD, un escaneo o una foto del plano).
Detecta los MUROS (paredes), las PUERTAS y las VENTANAS.
Reglas:
- Devuelve cada muro como un segmento RECTO por su eje central. Un muro en L, en T o con esquinas se divide en tramos rectos que se tocan en las esquinas.
- Coordenadas enteras de 0 a 1000 relativas a la imagen completa: x = 0 borde izquierdo, x = 1000 borde derecho; y = 0 borde superior, y = 1000 borde inferior.
- Puerta: el segmento del vano, de jamba a jamba (no el arco de giro). Ventana: el segmento de la ventana sobre el muro.
- Ignora cotas y líneas de acotación, textos, números, ejes, mobiliario, sanitarios, vehículos, árboles, achurados, rótulo y marco de la hoja.
- No inventes muros que no se vean. Si no hay plano legible, devuelve una lista vacía.`

const LARGO_MINIMO = 0.012
const TOL_EJE = 0.035 // pendiente máxima para enderezar (≈ 2°)
const TOL_COLINEAL = 0.006
const HUECO_UNION = 0.008

function n01(v: unknown): number | null {
  const x = Number(v)
  if (!Number.isFinite(x)) return null
  return Math.min(1, Math.max(0, x / 1000))
}

function redondear(v: number): number {
  return Math.round(v * 1000) / 1000
}

/** Endereza el segmento si es casi horizontal o casi vertical. */
export function enderezar(s: WallSegment): WallSegment {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  if (Math.abs(dy) <= Math.abs(dx) * TOL_EJE) {
    const y = (s.y1 + s.y2) / 2
    return { x1: Math.min(s.x1, s.x2), y1: y, x2: Math.max(s.x1, s.x2), y2: y }
  }
  if (Math.abs(dx) <= Math.abs(dy) * TOL_EJE) {
    const x = (s.x1 + s.x2) / 2
    return { x1: x, y1: Math.min(s.y1, s.y2), x2: x, y2: Math.max(s.y1, s.y2) }
  }
  return s
}

/** Une tramos horizontales/verticales colineales que se solapan o casi se tocan. */
export function unirColineales(segs: WallSegment[]): WallSegment[] {
  const horiz = segs.filter((s) => s.y1 === s.y2 && s.x1 !== s.x2)
  const vert = segs.filter((s) => s.x1 === s.x2 && s.y1 !== s.y2)
  const otros = segs.filter((s) => !horiz.includes(s) && !vert.includes(s))

  const unir = (lista: WallSegment[], horizontal: boolean): WallSegment[] => {
    const eje = (s: WallSegment) => (horizontal ? s.y1 : s.x1)
    const ini = (s: WallSegment) => (horizontal ? s.x1 : s.y1)
    const fin = (s: WallSegment) => (horizontal ? s.x2 : s.y2)
    const orden = [...lista].sort((a, b) => eje(a) - eje(b) || ini(a) - ini(b))
    const out: { e: number; a: number; b: number; n: number }[] = []
    for (const s of orden) {
      const previo = out.find(
        (o) => Math.abs(o.e - eje(s)) <= TOL_COLINEAL && ini(s) <= o.b + HUECO_UNION && fin(s) >= o.a - HUECO_UNION,
      )
      if (previo) {
        previo.e = (previo.e * previo.n + eje(s)) / (previo.n + 1)
        previo.n += 1
        previo.a = Math.min(previo.a, ini(s))
        previo.b = Math.max(previo.b, fin(s))
      } else {
        out.push({ e: eje(s), a: ini(s), b: fin(s), n: 1 })
      }
    }
    return out.map((o) =>
      horizontal ? { x1: o.a, y1: o.e, x2: o.b, y2: o.e } : { x1: o.e, y1: o.a, x2: o.e, y2: o.b },
    )
  }

  return [...unir(horiz, true), ...unir(vert, false), ...otros]
}

function limpiar(segs: WallSegment[], unirTramos: boolean): WallSegment[] {
  const rectos = segs
    .map(enderezar)
    .filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= LARGO_MINIMO)
  const unidos = unirTramos ? unirColineales(rectos) : rectos
  return unidos.map((s) => ({
    x1: redondear(s.x1),
    y1: redondear(s.y1),
    x2: redondear(s.x2),
    y2: redondear(s.y2),
  }))
}

const MAX_MUROS = 300
const MAX_ABERTURAS = 120

/** Convierte la respuesta de la IA en el mismo resultado que la detección de PDF. */
export function resultadoDesdeIa(raw: unknown): DetectWallsResult {
  const lista =
    raw && typeof raw === 'object' && Array.isArray((raw as { muros?: unknown }).muros)
      ? ((raw as { muros: unknown[] }).muros as SegmentoIa[])
      : []
  const porTipo: Record<TipoMuroIa, WallSegment[]> = { muro: [], puerta: [], ventana: [] }
  for (const m of lista) {
    if (!m || typeof m !== 'object') continue
    const x1 = n01(m.x1)
    const y1 = n01(m.y1)
    const x2 = n01(m.x2)
    const y2 = n01(m.y2)
    if (x1 == null || y1 == null || x2 == null || y2 == null) continue
    const tipo: TipoMuroIa = m.tipo === 'puerta' || m.tipo === 'ventana' ? m.tipo : 'muro'
    porTipo[tipo].push({ x1, y1, x2, y2 })
  }
  return {
    color: null,
    score: 0,
    walls: limpiar(porTipo.muro, true).slice(0, MAX_MUROS),
    doors: limpiar(porTipo.puerta, false).slice(0, MAX_ABERTURAS),
    windows: limpiar(porTipo.ventana, false).slice(0, MAX_ABERTURAS),
    polygonCount: 0,
    page: { width: 1000, height: 1000 },
  }
}

export function resumenMurosIa(r: DetectWallsResult): string {
  const m = r.walls.length
  const p = r.doors.length
  const v = r.windows.length
  if (m + p + v === 0) return 'La IA no encontró muros en este plano. Dibújalos a mano en Muros.'
  return `IA: ${m} muro${m === 1 ? '' : 's'}, ${p} puerta${p === 1 ? '' : 's'} y ${v} ventana${v === 1 ? '' : 's'}. Revisa y corrige lo que haga falta.`
}
