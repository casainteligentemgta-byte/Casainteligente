/**
 * Fotos de la lista de precios en PDF: lógica pura.
 *
 * Muchas listas traen una columna con la foto de cada producto. El navegador dice dónde
 * está cada imagen de la página (`extraerTextoPdf.ts`); aquí se decide a qué renglón
 * pertenece cada una y qué trozo de la página hay que recortar para ese renglón.
 */

/** Rectángulo en puntos de página; `y` es el borde de arriba y crece hacia abajo. */
export type CajaPdf = { x: number; y: number; w: number; h: number }

/**
 * Una imagen de la página: su rectángulo y cómo pedírsela a pdf.js para dibujarla.
 * Una foto puede venir partida en muchas imágenes (hay listas que la guardan en tiras de
 * un píxel de alto).
 */
export type ImagenPdf = CajaPdf & {
  /** Nombre de la imagen dentro del PDF (se le pide a la página). */
  id?: string
  /** La imagen misma, cuando viene escrita dentro de la página. */
  enLinea?: unknown
  /**
   * Matriz que lleva el cuadrado 0–1 de la imagen a su sitio en la página vista (con giro o
   * espejo si los tiene). Con ella se dibuja igual que en el PDF.
   */
  matriz?: number[]
}

/** Dónde quedó un renglón de la lista: la altura de su línea de precio. */
export type UbicacionFila = {
  /** `n` del renglón (el mismo de `FilaLista`). */
  n: number
  pagina: number
  /** Centro vertical de la línea del precio. */
  y: number
  /** Altura del encabezado de la tabla en esa página (0 si no lo hay). */
  yEncabezado: number
}

export type PaginaConImagenes = { numero: number; imagenes?: readonly ImagenPdf[]; ancho?: number; alto?: number }

export type RecorteFoto = {
  /** Nombre con el que el renglón se refiere a su foto (`FilaLista.foto`). */
  clave: string
  n: number
  pagina: number
  /** Rectángulo que abarca todas las imágenes del renglón. */
  caja: CajaPdf
  /** Las imágenes que forman la foto, en el orden en que se pintan. */
  piezas: ImagenPdf[]
}

type Matriz = readonly number[]

function multiplicar(a: Matriz, b: Matriz): number[] {
  return [
    a[0]! * b[0]! + a[2]! * b[1]!,
    a[1]! * b[0]! + a[3]! * b[1]!,
    a[0]! * b[2]! + a[2]! * b[3]!,
    a[1]! * b[2]! + a[3]! * b[3]!,
    a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
    a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
  ]
}

function aplicar(m: Matriz, x: number, y: number): [number, number] {
  return [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!]
}

/** Códigos de las órdenes de dibujo de pdf.js que hacen falta (se le pasan sus `OPS`). */
export type OrdenesPdf = {
  save: number
  restore: number
  transform: number
  paintFormXObjectBegin?: number
  paintFormXObjectEnd?: number
  paintImageXObject?: number
  paintInlineImageXObject?: number
  paintJpegXObject?: number
}

/**
 * Recorre las órdenes de dibujo de una página y devuelve el rectángulo de cada imagen.
 * Una imagen se pinta en el cuadrado 0–1 con la matriz vigente; `vista` pasa de las
 * coordenadas del PDF a las de la página vista (con la «y» hacia abajo).
 */
export function cajasDeImagenes(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  ops: OrdenesPdf,
  vista: Matriz,
): ImagenPdf[] {
  const cajas: ImagenPdf[] = []
  let actual: number[] = [1, 0, 0, 1, 0, 0]
  const pila: number[][] = []
  const pintan = [ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintJpegXObject].filter(
    (c): c is number => typeof c === 'number',
  )
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]!
    const args = argsArray[i]
    if (fn === ops.save) {
      pila.push(actual.slice())
    } else if (fn === ops.restore) {
      actual = pila.pop() ?? actual
    } else if (fn === ops.transform) {
      if (Array.isArray(args) && args.length >= 6) actual = multiplicar(actual, args as number[])
    } else if (ops.paintFormXObjectBegin != null && fn === ops.paintFormXObjectBegin) {
      pila.push(actual.slice())
      const matriz = Array.isArray(args) ? (args[0] as unknown) : null
      if (matriz && (matriz as number[]).length >= 6) actual = multiplicar(actual, Array.from(matriz as ArrayLike<number>))
    } else if (ops.paintFormXObjectEnd != null && fn === ops.paintFormXObjectEnd) {
      actual = pila.pop() ?? actual
    } else if (pintan.indexOf(fn) >= 0) {
      const total = multiplicar(vista, actual)
      const esquinas = [aplicar(total, 0, 0), aplicar(total, 1, 0), aplicar(total, 0, 1), aplicar(total, 1, 1)]
      const xs = esquinas.map((e) => e[0])
      const ys = esquinas.map((e) => e[1])
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const w = Math.max(...xs) - x
      const h = Math.max(...ys) - y
      if (![x, y, w, h].every((v) => Number.isFinite(v)) || w <= 0 || h <= 0) continue
      const imagen: ImagenPdf = { x, y, w, h, matriz: total }
      const primero = Array.isArray(args) ? (args[0] as unknown) : undefined
      if (typeof primero === 'string') imagen.id = primero
      else if (primero && typeof primero === 'object') imagen.enLinea = primero
      cajas.push(imagen)
    }
  }
  return cajas
}

/** Lado mínimo, en puntos, para que el conjunto cuente como foto (no una raya o un icono). */
const LADO_MINIMO = 10

/** Nombre de la foto de un renglón sacada del PDF. */
export function claveFotoPdf(pagina: number, n: number): string {
  return `pdf-p${pagina}-n${n}.jpg`
}

function abarcar(cajas: readonly CajaPdf[]): CajaPdf {
  const x = Math.min(...cajas.map((c) => c.x))
  const y = Math.min(...cajas.map((c) => c.y))
  return {
    x,
    y,
    w: Math.max(...cajas.map((c) => c.x + c.w)) - x,
    h: Math.max(...cajas.map((c) => c.y + c.h)) - y,
  }
}

/** Junta las imágenes que se tocan: las tiras de una foto partida, una foto y su etiqueta… */
function gruposQueSeTocan(imagenes: readonly ImagenPdf[]): ImagenPdf[][] {
  const HOLGURA = 1.5
  const jefe = imagenes.map((_, i) => i)
  const raiz = (i: number): number => {
    let r = i
    while (jefe[r] !== r) r = jefe[r]!
    jefe[i] = r
    return r
  }
  // Ordenadas por arriba: solo se comparan las que pueden tocarse en vertical.
  const orden = imagenes.map((_, i) => i).sort((a, b) => imagenes[a]!.y - imagenes[b]!.y)
  for (let a = 0; a < orden.length; a++) {
    const A = imagenes[orden[a]!]!
    for (let b = a + 1; b < orden.length; b++) {
      const B = imagenes[orden[b]!]!
      if (B.y > A.y + A.h + HOLGURA) break
      if (B.x <= A.x + A.w + HOLGURA && A.x <= B.x + B.w + HOLGURA) jefe[raiz(orden[b]!)] = raiz(orden[a]!)
    }
  }
  const grupos: Record<number, ImagenPdf[]> = {}
  imagenes.forEach((img, i) => {
    const r = raiz(i)
    ;(grupos[r] = grupos[r] ?? []).push(img)
  })
  return Object.keys(grupos).map((k) => grupos[Number(k)]!)
}

/**
 * A qué renglón pertenece cada imagen y qué hay que dibujar para su foto.
 *
 * La foto de un producto está a la altura de su renglón: se le da al renglón cuya línea de
 * precio queda más cerca de su centro, si de verdad está a su altura. Quedan fuera el
 * membrete (lo que está sobre el encabezado de la tabla), las rayas y los fondos que ocupan
 * media página. Las imágenes que se tocan van juntas: una foto guardada en tiras, o un kit
 * hecho con dos imágenes, salen como una sola foto.
 */
export function recortesDeFotos(paginas: readonly PaginaConImagenes[], ubicaciones: readonly UbicacionFila[]): RecorteFoto[] {
  const recortes: RecorteFoto[] = []
  for (const pagina of paginas) {
    const filas = ubicaciones.filter((u) => u.pagina === pagina.numero)
    const todas = pagina.imagenes ?? []
    if (filas.length === 0 || todas.length === 0) continue
    const yEncabezado = Math.min(...filas.map((f) => f.yEncabezado))
    const areaPagina = pagina.ancho && pagina.alto ? pagina.ancho * pagina.alto : 0
    const utiles = todas.filter((img) => {
      if (areaPagina > 0 && img.w * img.h > areaPagina * 0.35) return false
      // Una raya larga (un borde, un subrayado) no es parte de una foto.
      if ((img.h < 3 && img.w > 150) || (img.w < 3 && img.h > 150)) return false
      return img.y + img.h / 2 > yEncabezado
    })

    const porFila: Record<number, ImagenPdf[]> = {}
    const asignar = (piezas: ImagenPdf[]) => {
      const caja = abarcar(piezas)
      const centro = caja.y + caja.h / 2
      let cercana = filas[0]!
      for (const f of filas) if (Math.abs(f.y - centro) < Math.abs(cercana.y - centro)) cercana = f
      // A su altura: la línea del precio cae dentro de la imagen o muy cerca de ella.
      if (Math.abs(cercana.y - centro) > caja.h / 2 + Math.max(8, caja.h * 0.5)) return
      porFila[cercana.n] = (porFila[cercana.n] ?? []).concat(piezas)
    }
    for (const grupo of gruposQueSeTocan(utiles)) {
      const caja = abarcar(grupo)
      const dentro = filas.filter((f) => f.y >= caja.y && f.y <= caja.y + caja.h).length
      // Un grupo que abarca dos renglones son dos fotos pegadas: cada imagen va por su cuenta.
      if (dentro >= 2 && grupo.length > 1) for (const img of grupo) asignar([img])
      else asignar(grupo)
    }

    for (const f of filas) {
      const sinOrden = porFila[f.n]
      if (!sinOrden) continue
      // En el orden en que la página las pinta (lo de encima, al final).
      const piezas = todas.filter((img) => sinOrden.indexOf(img) >= 0)
      const caja = abarcar(piezas)
      if (caja.w < LADO_MINIMO || caja.h < LADO_MINIMO) continue
      recortes.push({ clave: claveFotoPdf(pagina.numero, f.n), n: f.n, pagina: pagina.numero, caja, piezas })
    }
  }
  return recortes
}

/** Escala para dibujar la página: nítida, pero sin pasar de lo que aguanta un teléfono. */
export function escalaParaRecortar(anchoPagina: number, altoPagina: number, maxPixeles = 7_000_000): number {
  const area = Math.max(1, anchoPagina * altoPagina)
  return Math.max(1, Math.min(4, Math.sqrt(maxPixeles / area)))
}

/** Píxeles por punto para que la foto salga con la nitidez que trae en el PDF, sin pasarse. */
export function escalaDeFoto(caja: CajaPdf, piezas: ReadonlyArray<{ w: number; anchoPx: number }>, maxLado = 1400): number {
  let escala = 1
  for (const p of piezas) if (p.w > 0 && p.anchoPx > 0) escala = Math.max(escala, p.anchoPx / p.w)
  escala = Math.min(escala, 8)
  const lado = Math.max(caja.w, caja.h) * escala
  return lado > maxLado ? (escala * maxLado) / lado : escala
}

/**
 * Pasa los píxeles de una imagen de pdf.js a RGBA. `kind`: 1 = un bit por píxel (blanco y
 * negro), 2 = RGB, 3 = RGBA. Devuelve `null` si el formato no es ninguno de esos.
 */
export function pixelesARgba(data: ArrayLike<number>, ancho: number, alto: number, kind: number): Uint8ClampedArray | null {
  const total = ancho * alto
  const salida = new Uint8ClampedArray(total * 4)
  if (kind === 3) {
    if (data.length < total * 4) return null
    for (let i = 0; i < total * 4; i++) salida[i] = data[i]!
    return salida
  }
  if (kind === 2) {
    if (data.length < total * 3) return null
    for (let i = 0, j = 0; i < total; i++, j += 3) {
      salida[i * 4] = data[j]!
      salida[i * 4 + 1] = data[j + 1]!
      salida[i * 4 + 2] = data[j + 2]!
      salida[i * 4 + 3] = 255
    }
    return salida
  }
  if (kind === 1) {
    const porFila = (ancho + 7) >> 3
    if (data.length < porFila * alto) return null
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const bit = (data[y * porFila + (x >> 3)]! >> (7 - (x & 7))) & 1
        const v = bit ? 255 : 0
        const i = (y * ancho + x) * 4
        salida[i] = v
        salida[i + 1] = v
        salida[i + 2] = v
        salida[i + 3] = 255
      }
    }
    return salida
  }
  return null
}
