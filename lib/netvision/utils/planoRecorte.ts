/**
 * Recorte automático de la captura del plano: quita el margen vacío del lienzo
 * del editor para que el plano llene su recuadro en la hoja de «Imprimir / PDF».
 */

export type RecorteBounds = { x: number; y: number; w: number; h: number }

type Rgb = [number, number, number]

function pixel(data: ArrayLike<number>, width: number, x: number, y: number): Rgb {
  const i = (y * width + x) * 4
  return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]
}

function distancia(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

/**
 * Color del margen: el de las esquinas, si al menos tres coinciden.
 * Si las esquinas no coinciden, el plano ya ocupa el lienzo y no hay margen que quitar.
 */
export function detectarFondoCaptura(
  data: ArrayLike<number>,
  width: number,
  height: number,
  tol = 40,
): Rgb | null {
  if (width < 8 || height < 8) return null
  const m = 2
  const esquinas: Rgb[] = [
    pixel(data, width, m, m),
    pixel(data, width, width - 1 - m, m),
    pixel(data, width, m, height - 1 - m),
    pixel(data, width, width - 1 - m, height - 1 - m),
  ]
  for (const base of esquinas) {
    const iguales = esquinas.filter((e) => distancia(e, base) <= tol)
    if (iguales.length >= 3) {
      const n = iguales.length
      return [
        Math.round(iguales.reduce((s, e) => s + e[0], 0) / n),
        Math.round(iguales.reduce((s, e) => s + e[1], 0) / n),
        Math.round(iguales.reduce((s, e) => s + e[2], 0) / n),
      ]
    }
  }
  return null
}

/**
 * Caja que contiene todo lo que no es margen (plano, etiquetas, cables).
 * `minPixeles` evita que el ruido del JPEG cuente como contenido.
 */
export function limitesContenidoCaptura(
  data: ArrayLike<number>,
  width: number,
  height: number,
  opts: { tol?: number; minPixeles?: number } = {},
): RecorteBounds | null {
  const tol = opts.tol ?? 40
  const minPixeles = opts.minPixeles ?? 3
  const fondo = detectarFondoCaptura(data, width, height, tol)
  if (!fondo) return null

  const porFila = new Uint32Array(height)
  const porColumna = new Uint32Array(width)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (distancia(pixel(data, width, x, y), fondo) > tol) {
        porFila[y] += 1
        porColumna[x] += 1
      }
    }
  }
  let top = 0
  while (top < height && porFila[top]! < minPixeles) top++
  if (top >= height) return null
  let bottom = height - 1
  while (bottom > top && porFila[bottom]! < minPixeles) bottom--
  let left = 0
  while (left < width && porColumna[left]! < minPixeles) left++
  let right = width - 1
  while (right > left && porColumna[right]! < minPixeles) right--
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 }
}

/** Agranda la caja un margen (fracción del lado mayor) sin salirse de la imagen. */
export function expandirRecorte(
  b: RecorteBounds,
  width: number,
  height: number,
  margen = 0.02,
): RecorteBounds {
  const pad = Math.round(Math.max(b.w, b.h) * margen)
  const x = Math.max(0, b.x - pad)
  const y = Math.max(0, b.y - pad)
  const right = Math.min(width, b.x + b.w + pad)
  const bottom = Math.min(height, b.y + b.h + pad)
  return { x, y, w: right - x, h: bottom - y }
}

/** ¿Vale la pena recortar? Solo si el plano ocupa claramente menos que el lienzo. */
export function recorteGanaEspacio(b: RecorteBounds, width: number, height: number): boolean {
  return (b.w * b.h) / (width * height) < 0.9
}

/** Límite de desplazamiento del plano ampliado, como fracción del recuadro. */
export function limiteDesplazamiento(zoom: number): number {
  return Math.max(0, (zoom - 1) / 2)
}

export function acotarDesplazamiento(
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  const max = limiteDesplazamiento(zoom)
  const c = (v: number) => Math.min(max, Math.max(-max, Number.isFinite(v) ? v : 0))
  return { x: c(pan.x), y: c(pan.y) }
}

export const PLANO_ZOOM_MIN = 1
export const PLANO_ZOOM_MAX = 4
export const PLANO_ZOOM_PASO = 0.25

export function acotarZoom(zoom: number): number {
  const z = Number.isFinite(zoom) ? zoom : 1
  return Math.min(PLANO_ZOOM_MAX, Math.max(PLANO_ZOOM_MIN, Math.round(z / PLANO_ZOOM_PASO) * PLANO_ZOOM_PASO))
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la captura del plano.'))
    img.src = src
  })
}

/**
 * Devuelve la captura recortada al plano. Si no hay margen que quitar (o algo falla),
 * devuelve la captura original.
 */
export async function recortarCapturaPlano(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) return dataUrl
  try {
    const img = await cargarImagen(dataUrl)
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return dataUrl

    // El análisis se hace en pequeño: basta para ubicar los bordes.
    const escala = Math.min(1, 480 / w)
    const aw = Math.max(8, Math.round(w * escala))
    const ah = Math.max(8, Math.round(h * escala))
    const analisis = document.createElement('canvas')
    analisis.width = aw
    analisis.height = ah
    const actx = analisis.getContext('2d', { willReadFrequently: true })
    if (!actx) return dataUrl
    actx.drawImage(img, 0, 0, aw, ah)
    const bounds = limitesContenidoCaptura(actx.getImageData(0, 0, aw, ah).data, aw, ah)
    if (!bounds || !recorteGanaEspacio(bounds, aw, ah)) return dataUrl

    const caja = expandirRecorte(bounds, aw, ah)
    const sx = Math.floor(caja.x / escala)
    const sy = Math.floor(caja.y / escala)
    const sw = Math.min(w - sx, Math.ceil(caja.w / escala))
    const sh = Math.min(h - sy, Math.ceil(caja.h / escala))
    if (sw < 16 || sh < 16) return dataUrl

    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const octx = out.getContext('2d')
    if (!octx) return dataUrl
    octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    return out.toDataURL('image/jpeg', 0.92)
  } catch {
    return dataUrl
  }
}
