/**
 * Saca del PDF los trozos de texto con su posición, página por página, en el navegador.
 * El archivo no sale del equipo de quien lo sube: se lee aquí mismo y no se guarda.
 *
 * La interpretación (qué es un producto, qué es un precio) está en `leerListaPdf.ts`.
 */
import type { PaginaPdf, TrozoPdf } from './leerListaPdf'

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
      paginas.push({ numero: n, trozos: trozosDeItems(contenido.items, viewport.height) })
      alAvanzar?.(n, total)
    }
    return paginas
  } finally {
    await tarea.destroy()
  }
}
