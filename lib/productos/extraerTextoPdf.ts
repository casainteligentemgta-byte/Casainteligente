/**
 * Saca del PDF los trozos de texto con su posición, página por página, en el navegador.
 * El archivo no sale del equipo de quien lo sube: se lee aquí mismo y no se guarda.
 *
 * La interpretación (qué es un producto, qué es un precio) está en `leerListaPdf.ts`.
 */
import type { PaginaPdf, TrozoPdf } from './leerListaPdf'
import {
  cajasDeImagenes,
  escalaDeFoto,
  escalaParaRecortar,
  pixelesARgba,
  type ImagenPdf,
  type OrdenesPdf,
  type RecorteFoto,
} from './fotosListaPdf'

/** Tope para no colgar el teléfono con un PDF enorme. */
export const MAX_PAGINAS_LISTA_PDF = 400

type ItemTexto = { str?: string; transform?: number[]; width?: number; height?: number }

/** Convierte los items de una página de pdf.js en trozos con `y` hacia abajo. */
export function trozosDeItems(items: readonly unknown[], altoPagina: number): TrozoPdf[] {
  const trozos: TrozoPdf[] = []
  for (const raw of items) {
    const item = raw as ItemTexto
    if (!item.str || !item.transform || item.str.trim() === '') continue
    const x = item.transform[4] ?? 0
    const base = item.transform[5] ?? 0
    // La altura del tipo de letra: la que declara el item o la escala vertical del texto.
    const h = item.height && item.height > 0 ? item.height : Math.abs(item.transform[3] ?? 0) || 8
    trozos.push({
      str: item.str,
      x,
      y: altoPagina - base - h,
      w: item.width && item.width > 0 ? item.width : item.str.length * h * 0.5,
      h,
    })
  }
  return trozos
}

export async function extraerPaginasPdf(
  datos: Uint8Array,
  alAvanzar?: (pagina: number, total: number) => void,
): Promise<PaginaPdf[]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const tarea = pdfjs.getDocument({ data: datos.slice() })
  const doc = await tarea.promise
  try {
    const total = Math.min(doc.numPages, MAX_PAGINAS_LISTA_PDF)
    const paginas: PaginaPdf[] = []
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n)
      const viewport = page.getViewport({ scale: 1 })
      const contenido = await page.getTextContent()
      // Dónde están las imágenes de la página. Si esto falla, la lista se lee igual, sin fotos.
      let imagenes: ImagenPdf[] = []
      try {
        const ordenes = await page.getOperatorList()
        imagenes = cajasDeImagenes(ordenes.fnArray, ordenes.argsArray, pdfjs.OPS as unknown as OrdenesPdf, viewport.transform)
      } catch {
        imagenes = []
      }
      paginas.push({
        numero: n,
        trozos: trozosDeItems(contenido.items, viewport.height),
        imagenes,
        ancho: viewport.width,
        alto: viewport.height,
      })
      alAvanzar?.(n, total)
    }
    return paginas
  } finally {
    await tarea.destroy()
  }
}

type Pintable = { fuente: CanvasImageSource; ancho: number; alto: number }

/** Algo de pdf.js que se parece a una imagen: un mapa de bits ya hecho o sus píxeles. */
type ImagenDePdfJs = {
  /** Mapa de bits ya hecho: un ImageBitmap o, si el navegador descifró un JPEG, un VideoFrame. */
  bitmap?: (CanvasImageSource & { width?: number; height?: number; displayWidth?: number; displayHeight?: number }) | null
  data?: ArrayLike<number> | null
  width?: number
  height?: number
  kind?: number
}

/** Convierte lo que entrega pdf.js en algo que un lienzo puede dibujar. */
function aPintable(obj: unknown): Pintable | null {
  if (!obj || typeof obj !== 'object') return null
  const img = obj as ImagenDePdfJs
  if (img.bitmap) {
    const ancho = Number(img.width || img.bitmap.width || img.bitmap.displayWidth || 0)
    const alto = Number(img.height || img.bitmap.height || img.bitmap.displayHeight || 0)
    return ancho > 0 && alto > 0 ? { fuente: img.bitmap, ancho, alto } : null
  }
  if (typeof HTMLCanvasElement !== 'undefined' && obj instanceof HTMLCanvasElement) return { fuente: obj, ancho: obj.width, alto: obj.height }
  if (typeof HTMLImageElement !== 'undefined' && obj instanceof HTMLImageElement) return { fuente: obj, ancho: obj.naturalWidth, alto: obj.naturalHeight }
  if (img.data && img.width && img.height && img.kind) {
    const rgba = pixelesARgba(img.data, img.width, img.height, img.kind)
    if (!rgba) return null
    const lienzo = document.createElement('canvas')
    lienzo.width = img.width
    lienzo.height = img.height
    const ctx = lienzo.getContext('2d')
    if (!ctx) return null
    const datos = ctx.createImageData(img.width, img.height)
    datos.data.set(rgba)
    ctx.putImageData(datos, 0, 0)
    return { fuente: lienzo, ancho: img.width, alto: img.height }
  }
  return null
}

type PaginaDePdfJs = {
  objs: { get: (id: string, alTener?: (obj: unknown) => void) => unknown }
  commonObjs: { get: (id: string, alTener?: (obj: unknown) => void) => unknown }
}

/** Pide a la página una de sus imágenes (espera un poco si todavía se está descifrando). */
function imagenDePagina(page: PaginaDePdfJs, id: string): Promise<unknown> {
  const almacen = id.indexOf('g_') === 0 ? page.commonObjs : page.objs
  return new Promise((ok, mal) => {
    const espera = setTimeout(() => mal(new Error('La imagen no llegó.')), 5000)
    try {
      almacen.get(id, (obj) => {
        clearTimeout(espera)
        ok(obj)
      })
    } catch (e) {
      clearTimeout(espera)
      mal(e)
    }
  })
}

function aJpeg(lienzo: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.9))
}

/**
 * Dibuja la foto de un renglón con sus propias imágenes, sobre fondo blanco. Así no se
 * cuelan las rayas de la tabla ni el texto de la casilla de al lado.
 */
async function componerFoto(page: PaginaDePdfJs, recorte: RecorteFoto): Promise<Blob | null> {
  const piezas: Array<{ pieza: ImagenPdf; pintable: Pintable }> = []
  for (const pieza of recorte.piezas) {
    if (!pieza.matriz) throw new Error('Imagen sin posición.')
    const obj = pieza.id ? await imagenDePagina(page, pieza.id) : pieza.enLinea
    const pintable = aPintable(obj)
    if (!pintable) throw new Error('Formato de imagen no previsto.')
    piezas.push({ pieza, pintable })
  }
  if (piezas.length === 0) return null
  const escala = escalaDeFoto(
    recorte.caja,
    piezas.map((p) => ({ w: p.pieza.w, anchoPx: p.pintable.ancho })),
  )
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(recorte.caja.w * escala))
  lienzo.height = Math.max(1, Math.round(recorte.caja.h * escala))
  const ctx = lienzo.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, lienzo.width, lienzo.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  for (const { pieza, pintable } of piezas) {
    const m = pieza.matriz!
    ctx.save()
    // De puntos de página a píxeles de la foto…
    ctx.setTransform(escala, 0, 0, escala, -recorte.caja.x * escala, -recorte.caja.y * escala)
    // …la imagen en su sitio (con su giro o espejo)…
    ctx.transform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!)
    // …y el cuadrado 0–1 del PDF tiene la primera fila de la imagen arriba (y = 1).
    ctx.transform(1, 0, 0, -1, 0, 1)
    // Medio píxel de más: las tiras de una foto partida no dejan rendijas blancas.
    const demasX = 0.5 / Math.max(1, pieza.w * escala)
    const demasY = 0.5 / Math.max(1, pieza.h * escala)
    ctx.drawImage(pintable.fuente, 0, 0, pintable.ancho, pintable.alto, 0, -demasY, 1 + demasX, 1 + demasY)
    ctx.restore()
  }
  const blob = await aJpeg(lienzo)
  lienzo.width = 0
  lienzo.height = 0
  return blob
}

/**
 * Saca del PDF la foto de cada renglón, en el navegador. Devuelve un JPEG por foto
 * (nombre de la foto → imagen).
 *
 * Primero intenta armar cada foto con las imágenes del propio PDF (queda limpia). Si alguna
 * no se deja (viene en un formato raro), dibuja la página entera y recorta su
 * rectángulo. Si una página falla, se sigue con las demás.
 */
export async function recortarFotosPdf(
  datos: Uint8Array,
  recortes: readonly RecorteFoto[],
  alAvanzar?: (hechas: number, total: number) => void,
): Promise<Record<string, Blob>> {
  const fotos: Record<string, Blob> = {}
  if (recortes.length === 0 || typeof document === 'undefined') return fotos
  const porPagina: Record<number, RecorteFoto[]> = {}
  for (const r of recortes) (porPagina[r.pagina] = porPagina[r.pagina] ?? []).push(r)
  const numeros = Object.keys(porPagina).map(Number).sort((a, b) => a - b)

  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const tarea = pdfjs.getDocument({ data: datos.slice() })
  const doc = await tarea.promise
  try {
    let hechas = 0
    for (const numero of numeros) {
      try {
        const page = await doc.getPage(numero)
        // Al pedir las órdenes de dibujo, pdf.js deja listas las imágenes de la página.
        await page.getOperatorList()
        const porRecortar: RecorteFoto[] = []
        for (const r of porPagina[numero]!) {
          try {
            const blob = await componerFoto(page as unknown as PaginaDePdfJs, r)
            if (blob) fotos[r.clave] = blob
          } catch {
            porRecortar.push(r)
          }
        }
        if (porRecortar.length > 0) {
          const base = page.getViewport({ scale: 1 })
          const escala = escalaParaRecortar(base.width, base.height)
          const viewport = page.getViewport({ scale: escala })
          const lienzo = document.createElement('canvas')
          lienzo.width = Math.ceil(viewport.width)
          lienzo.height = Math.ceil(viewport.height)
          const ctx = lienzo.getContext('2d')
          if (ctx) {
            // `canvas` lo piden las versiones nuevas de pdf.js; `canvasContext`, las anteriores.
            await page.render({ canvasContext: ctx, viewport, canvas: lienzo } as never).promise
            for (const r of porRecortar) {
              const x = Math.max(0, Math.floor(r.caja.x * escala))
              const y = Math.max(0, Math.floor(r.caja.y * escala))
              const w = Math.min(lienzo.width - x, Math.ceil(r.caja.w * escala))
              const h = Math.min(lienzo.height - y, Math.ceil(r.caja.h * escala))
              if (w < 8 || h < 8) continue
              const trozo = document.createElement('canvas')
              trozo.width = w
              trozo.height = h
              const tctx = trozo.getContext('2d')
              if (!tctx) continue
              tctx.fillStyle = '#ffffff'
              tctx.fillRect(0, 0, w, h)
              tctx.drawImage(lienzo, x, y, w, h, 0, 0, w, h)
              const blob = await aJpeg(trozo)
              if (blob) fotos[r.clave] = blob
              trozo.width = 0
              trozo.height = 0
            }
          }
          // Soltar la memoria del lienzo grande antes de la página siguiente.
          lienzo.width = 0
          lienzo.height = 0
        }
        page.cleanup()
      } catch {
        /* esa página se queda sin fotos */
      }
      hechas += 1
      alAvanzar?.(hechas, numeros.length)
    }
    return fotos
  } finally {
    await tarea.destroy()
  }
}
