/** Rasterizado nítido de planos CAD/PDF para NetVision (acotamiento y trazos finos). */

/** Lado largo objetivo en px (texto ~6 pt queda ~25 px en A4, no ~9 px). */
export const PDF_PLANO_TARGET_LONG_EDGE = 3200
/** Tope GPU / iPad: lienzos mayores a 4096 fallan en varios WebKit. */
export const PDF_PLANO_MAX_LONG_EDGE = 4096
/** Mínimo si la hoja ya es grande; se recorta si choca con el tope. */
export const PDF_PLANO_MIN_SCALE = 2
/** JPEG de respaldo si el PNG supera el cupo (línea de CAD suele ir en PNG). */
export const PDF_PLANO_JPEG_QUALITY = 0.97
/** ~4 MB binarios en data URL; por encima se usa JPEG para no tumbar sessionStorage. */
export const PDF_PLANO_PNG_MAX_CHARS = 5_500_000

/**
 * Escala PDF.js (1.0 = 72 dpi / 1 CSS px por punto).
 * A4 ~842 pt → ~3.8× (3200 px). Hoja 36" se limita a 4096 px.
 */
export function pdfPlanoRenderScale(pageWidthPt: number, pageHeightPt: number): number {
  const longEdge = Math.max(pageWidthPt, pageHeightPt)
  if (!(longEdge > 0) || !Number.isFinite(longEdge)) return PDF_PLANO_MIN_SCALE
  const maxScale = PDF_PLANO_MAX_LONG_EDGE / longEdge
  const minScale = Math.min(PDF_PLANO_MIN_SCALE, maxScale)
  const target = PDF_PLANO_TARGET_LONG_EDGE / longEdge
  return Math.min(maxScale, Math.max(minScale, target))
}

/** PNG sin pérdida para líneas/números; JPEG 0.97 solo si el PNG es enorme. */
export function encodePlanoCanvas(canvas: HTMLCanvasElement): string {
  const png = canvas.toDataURL('image/png')
  if (png.length <= PDF_PLANO_PNG_MAX_CHARS) return png
  return canvas.toDataURL('image/jpeg', PDF_PLANO_JPEG_QUALITY)
}

/**
 * Suavizar solo al reducir el bitmap. Al ampliar (leer acotamiento) nearest-neighbor
 * evita que Konva empaste los dígitos.
 */
export function shouldSmoothPlanoImage(
  sourceW: number,
  drawW: number,
  zoom: number,
): boolean {
  if (!(sourceW > 0) || !(drawW > 0) || !Number.isFinite(zoom)) return true
  return (drawW / sourceW) * zoom < 0.95
}

export async function renderPdfFirstPageFromBytes(data: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = pdfPlanoRenderScale(base.width, base.height)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const width = Math.max(1, Math.round(viewport.width))
    const height = Math.max(1, Math.round(viewport.height))
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('No se pudo crear el canvas del PDF.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    await page.render({
      canvasContext: ctx,
      viewport,
      intent: 'print',
    }).promise
    return encodePlanoCanvas(canvas)
  } finally {
    await doc.destroy()
  }
}
