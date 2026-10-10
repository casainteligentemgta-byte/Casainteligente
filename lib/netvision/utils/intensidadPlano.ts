/**
 * Intensidad de los trazos del plano y del espectro (semáforo) de las cámaras.
 *
 * - `intensificarTrazosPlano`: oscurece y engruesa muros y líneas del plano y limpia el
 *   papel. Sirve sobre todo para fotos de planos (grises, con sombras) y PDFs de línea fina.
 * - `intensidadCobertura`: 0–100, qué tan opaco se pinta el semáforo de las cámaras.
 */

/** Intensidad de cobertura por defecto (equivale al 36 % de opacidad de siempre). */
export const COBERTURA_INTENSIDAD_DEFECTO = 36

export function clampIntensidad(raw: unknown, porDefecto = 0): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return porDefecto
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** Opacidad 0–1 del semáforo a partir de la intensidad guardada en el proyecto. */
export function opacidadCobertura(intensidad: unknown): number {
  const v = clampIntensidad(intensidad, COBERTURA_INTENSIDAD_DEFECTO)
  return Math.min(0.95, Math.max(0.05, v / 100))
}

/** Factor respecto a la opacidad de siempre (1 = como antes). */
export function factorCobertura(intensidad: unknown): number {
  return opacidadCobertura(intensidad) / (COBERTURA_INTENSIDAD_DEFECTO / 100)
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Nivel del papel: percentil alto de la luminancia (el fondo de una foto no es blanco puro). */
function nivelPapel(lum: Float32Array): number {
  const hist = new Uint32Array(256)
  for (let i = 0; i < lum.length; i++) hist[Math.min(255, Math.max(0, lum[i]! | 0))]!++
  const objetivo = lum.length * 0.9
  let acum = 0
  for (let v = 0; v < 256; v++) {
    acum += hist[v]!
    if (acum >= objetivo) return Math.max(96, v)
  }
  return 255
}

/** Mínimo en una ventana (2r+1)² separable: engruesa los trazos oscuros. */
function minFiltro(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    const fila = y * w
    for (let x = 0; x < w; x++) {
      let m = 255
      const a = Math.max(0, x - r)
      const b = Math.min(w - 1, x + r)
      for (let k = a; k <= b; k++) {
        const v = src[fila + k]!
        if (v < m) m = v
      }
      tmp[fila + x] = m
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 255
      const a = Math.max(0, y - r)
      const b = Math.min(h - 1, y + r)
      for (let k = a; k <= b; k++) {
        const v = tmp[k * w + x]!
        if (v < m) m = v
      }
      out[y * w + x] = m
    }
  }
  return out
}

/**
 * Oscurece y engruesa los trazos del plano (0 = sin cambio, 100 = máximo).
 * Trabaja en escala de grises: el plano queda con trazos negros nítidos sobre papel blanco.
 */
export function intensificarTrazosPlano(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
  intensidad: unknown,
): void {
  const k = clampIntensidad(intensidad) / 100
  const w = width | 0
  const h = height | 0
  if (k <= 0 || w < 1 || h < 1 || data.length < w * h * 4) return
  const n = w * h
  const lum = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    lum[i] = luma(data[p] as number, data[p + 1] as number, data[p + 2] as number)
  }
  const papel = nivelPapel(lum)
  const gamma = 1 + 5 * k
  const umbralBlanco = 1 - 0.18 * k
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let v = Math.min(1, lum[i]! / papel)
    v = v >= umbralBlanco ? 1 : Math.pow(v / umbralBlanco, gamma)
    out[i] = v * 255
  }
  const engrosado = minFiltro(out, w, h, Math.round(k * 2))
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const v = Math.round(engrosado[i]!)
    data[p] = v
    data[p + 1] = v
    data[p + 2] = v
  }
}
