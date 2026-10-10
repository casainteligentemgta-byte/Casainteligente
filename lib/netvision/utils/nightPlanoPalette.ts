/** Paleta de plano en fondo negro: muros blancos, acotamiento en neón. */

export const NIGHT_BG: readonly [number, number, number] = [0, 0, 0]
export const NIGHT_WALL: readonly [number, number, number] = [255, 255, 255]
/** Trazo de detalle (muebles, autos, hatches) no debe quedar más oscuro que esto. */
export const NIGHT_DETAIL_MIN = 168
/** Por encima de esto se considera papel. */
export const NIGHT_PAPER_LUMA = 236
/** Verde, naranja, azul eléctrico (monitor). */
export const NIGHT_NEON: ReadonlyArray<readonly [number, number, number]> = [
  [57, 255, 32],
  [255, 140, 0],
  [0, 168, 255],
]

export const NIGHT_COTA_COLORES = ['auto', 'verde', 'naranja', 'azul', 'blanco'] as const
export type NightCotaColor = (typeof NIGHT_COTA_COLORES)[number]

export type NightPlanoOptions = {
  /** Fuerza el neón de cotas/números. `auto` = según forma y cercanía. */
  cotaColor?: NightCotaColor
  /**
   * Grosor de la línea de muro (0 = más fina, 100 = más gruesa).
   * Default 50 = dilatar 2 px (comportamiento actual).
   */
  grosorMuro?: number
  /** Intensidad de los trazos (0–100); se aplica antes de pasar a fondo negro. */
  intensidadTrazos?: number
}

/** Índice en NIGHT_NEON, o -1 = blanco (mismo RGB que muros). */
export function neonIndexForColor(color: NightCotaColor): number | null {
  if (color === 'verde') return 0
  if (color === 'naranja') return 1
  if (color === 'azul') return 2
  if (color === 'blanco') return -1
  return null
}

export function clampGrosorMuro(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** Radio de dilatación del núcleo de muro (0–4). */
export function wallDilateFromGrosor(grosor: unknown): number {
  return Math.round((clampGrosorMuro(grosor) / 100) * 4)
}

export function normalizeCotaColor(raw: unknown): NightCotaColor {
  const t = String(raw ?? '').trim().toLowerCase()
  if (t === 'amarillo') return 'azul'
  if (t === 'verde' || t === 'naranja' || t === 'azul' || t === 'blanco' || t === 'auto') {
    return t
  }
  return 'auto'
}

/** Blanco sobre fondo negro: las cotas/muros blancos van encima del semáforo. */
export function liftWhitePlanOverVision(
  invert: boolean,
  cotaColor?: unknown,
): boolean {
  return Boolean(invert) && normalizeCotaColor(cotaColor) === 'blanco'
}

const INF = 1_000_000
const CHAMFER_A = 3
const CHAMFER_B = 4
/** Núcleo grueso ≈ 3 px (muros). Las cotas suelen ser 1–2 px. */
const THICK_CORE = CHAMFER_A * 2

type Component = {
  id: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  area: number
  sumX: number
  sumY: number
}

function invertAndLift(
  r: number,
  g: number,
  b: number,
): readonly [number, number, number] {
  const ir = 255 - r
  const ig = 255 - g
  const ib = 255 - b
  const y = luma(ir, ig, ib)
  if (y >= NIGHT_DETAIL_MIN) return [ir, ig, ib]
  if (y < 1) return [NIGHT_DETAIL_MIN, NIGHT_DETAIL_MIN, NIGHT_DETAIL_MIN]
  const s = NIGHT_DETAIL_MIN / y
  return [
    Math.min(255, Math.round(ir * s)),
    Math.min(255, Math.round(ig * s)),
    Math.min(255, Math.round(ib * s)),
  ]
}

function invertRgbFallback(data: Uint8ClampedArray | number[]): void {
  for (let i = 0; i + 2 < data.length; i += 4) {
    const r = data[i] as number
    const g = data[i + 1] as number
    const b = data[i + 2] as number
    if (luma(r, g, b) >= NIGHT_PAPER_LUMA) {
      data[i] = NIGHT_BG[0]
      data[i + 1] = NIGHT_BG[1]
      data[i + 2] = NIGHT_BG[2]
      continue
    }
    const rgb = invertAndLift(r, g, b)
    data[i] = rgb[0]
    data[i + 1] = rgb[1]
    data[i + 2] = rgb[2]
  }
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isLineDrawing(inkCount: number, midCount: number, n: number): boolean {
  if (n <= 0 || inkCount === 0) return false
  return inkCount / n <= 0.28 && midCount / n <= 0.35
}

function chamferDistance(ink: Uint8Array, w: number, h: number): Int32Array {
  const dist = new Int32Array(w * h)
  for (let i = 0; i < dist.length; i++) dist[i] = ink[i] ? INF : 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!ink[i]) continue
      let d = dist[i]!
      if (x > 0) d = Math.min(d, dist[i - 1]! + CHAMFER_A)
      if (y > 0) d = Math.min(d, dist[i - w]! + CHAMFER_A)
      if (x > 0 && y > 0) d = Math.min(d, dist[i - w - 1]! + CHAMFER_B)
      if (x + 1 < w && y > 0) d = Math.min(d, dist[i - w + 1]! + CHAMFER_B)
      dist[i] = d
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (!ink[i]) continue
      let d = dist[i]!
      if (x + 1 < w) d = Math.min(d, dist[i + 1]! + CHAMFER_A)
      if (y + 1 < h) d = Math.min(d, dist[i + w]! + CHAMFER_A)
      if (x + 1 < w && y + 1 < h) d = Math.min(d, dist[i + w + 1]! + CHAMFER_B)
      if (x > 0 && y + 1 < h) d = Math.min(d, dist[i + w - 1]! + CHAMFER_B)
      dist[i] = d
    }
  }
  return dist
}

function dilateMask(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(src)
  if (radius < 1) return out
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(h - 1, y + radius)
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(w - 1, x + radius)
      for (let yy = y0; yy <= y1; yy++) {
        const row = yy * w
        for (let xx = x0; xx <= x1; xx++) out[row + xx] = 1
      }
    }
  }
  return out
}

function labelThinComponents(
  thin: Uint8Array,
  w: number,
  h: number,
): { labels: Int32Array; comps: Component[] } {
  const labels = new Int32Array(w * h)
  const comps: Component[] = []
  const stack: number[] = []
  let next = 1
  const n4 = [1, -1, w, -w]

  for (let start = 0; start < thin.length; start++) {
    if (!thin[start] || labels[start]) continue
    const id = next++
    const comp: Component = {
      id,
      minX: start % w,
      minY: (start / w) | 0,
      maxX: start % w,
      maxY: (start / w) | 0,
      area: 0,
      sumX: 0,
      sumY: 0,
    }
    labels[start] = id
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      const x = i % w
      const y = (i / w) | 0
      comp.area++
      comp.sumX += x
      comp.sumY += y
      if (x < comp.minX) comp.minX = x
      if (x > comp.maxX) comp.maxX = x
      if (y < comp.minY) comp.minY = y
      if (y > comp.maxY) comp.maxY = y
      for (const d of n4) {
        const j = i + d
        if (j < 0 || j >= thin.length) continue
        if (d === 1 && x === w - 1) continue
        if (d === -1 && x === 0) continue
        if (!thin[j] || labels[j]) continue
        labels[j] = id
        stack.push(j)
      }
    }
    comps.push(comp)
  }
  return { labels, comps }
}

function isCompactText(c: Component, pageMin: number): boolean {
  const bw = c.maxX - c.minX + 1
  const bh = c.maxY - c.minY + 1
  const longer = Math.max(bw, bh)
  return c.area >= 4 && longer <= pageMin * 0.08 && c.area <= pageMin * 1.6
}

function neonIndexFor(c: Component): number {
  return Math.abs(c.minX + c.minY * 3) % NIGHT_NEON.length
}

function nearestTextNeon(
  c: Component,
  texts: Array<Component & { neon: number }>,
  pageMin: number,
): number | null {
  const cx = c.sumX / Math.max(c.area, 1)
  const cy = c.sumY / Math.max(c.area, 1)
  const maxD = pageMin * 0.08
  let best: number | null = null
  let bestD = maxD
  for (const t of texts) {
    const tx = t.sumX / Math.max(t.area, 1)
    const ty = t.sumY / Math.max(t.area, 1)
    const d = Math.hypot(cx - tx, cy - ty)
    if (d < bestD) {
      bestD = d
      best = t.neon
    }
  }
  return best
}

/** Verde horizontal, naranja vertical, azul el resto. */
function neonByShape(c: Component): number {
  const bw = c.maxX - c.minX + 1
  const bh = c.maxY - c.minY + 1
  if (bw > bh * 1.8) return 0
  if (bh > bw * 1.8) return 1
  return 2
}

function isMediumDimLine(c: Component, pageMin: number): boolean {
  const longer = Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1)
  return c.area >= 3 && longer >= 8 && longer <= pageMin * 0.36
}

/**
 * Papel → negro; muros gruesos → blanco; cotas → neón;
 * muebles/autos/hatches (grises) → trazo claro para que no se pierdan.
 * Si el bitmap no parece un plano de líneas, invierte y levanta el detalle.
 */
export function applyNightPlanoPalette(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
  options?: NightPlanoOptions,
): void {
  const w = width | 0
  const h = height | 0
  if (w < 2 || h < 2 || data.length < w * h * 4) {
    invertRgbFallback(data)
    return
  }

  const n = w * h
  const ink = new Uint8Array(n)
  let inkCount = 0
  let midCount = 0
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const y = luma(data[p] as number, data[p + 1] as number, data[p + 2] as number)
    if (y < 88) {
      ink[i] = 1
      inkCount++
    } else if (y < NIGHT_PAPER_LUMA) {
      midCount++
    }
  }

  if (!isLineDrawing(inkCount, midCount, n)) {
    invertRgbFallback(data)
    return
  }

  const dist = chamferDistance(ink, w, h)
  const core = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (ink[i] && dist[i]! >= THICK_CORE) core[i] = 1
  }
  const thick = dilateMask(core, w, h, wallDilateFromGrosor(options?.grosorMuro))
  const thin = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (ink[i] && !thick[i]) thin[i] = 1
  }

  const pageMin = Math.min(w, h)
  const { labels, comps } = labelThinComponents(thin, w, h)
  const locked = neonIndexForColor(normalizeCotaColor(options?.cotaColor))
  const texts = comps.filter((c) => isCompactText(c, pageMin)).map((c) => ({
    ...c,
    neon: locked ?? neonIndexFor(c),
  }))
  const neonById = new Map<number, number>()
  for (const t of texts) neonById.set(t.id, t.neon)
  for (const c of comps) {
    if (neonById.has(c.id)) continue
    if (c.area < 3) continue
    if (locked != null) {
      neonById.set(c.id, locked)
      continue
    }
    const near = nearestTextNeon(c, texts, pageMin)
    if (near !== null) {
      neonById.set(c.id, near)
      continue
    }
    if (isMediumDimLine(c, pageMin)) neonById.set(c.id, neonByShape(c))
  }

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (!ink[i]) {
      const y = luma(data[p] as number, data[p + 1] as number, data[p + 2] as number)
      if (y >= NIGHT_PAPER_LUMA) {
        data[p] = NIGHT_BG[0]
        data[p + 1] = NIGHT_BG[1]
        data[p + 2] = NIGHT_BG[2]
      } else {
        const rgb = invertAndLift(
          data[p] as number,
          data[p + 1] as number,
          data[p + 2] as number,
        )
        data[p] = rgb[0]
        data[p + 1] = rgb[1]
        data[p + 2] = rgb[2]
      }
      continue
    }
    const nid = labels[i]!
    const neon = nid ? neonById.get(nid) : undefined
    const rgb =
      neon === -1 ? NIGHT_WALL : neon !== undefined ? NIGHT_NEON[neon]! : NIGHT_WALL
    data[p] = rgb[0]
    data[p + 1] = rgb[1]
    data[p + 2] = rgb[2]
  }
}
