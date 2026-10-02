/** Lee números de acotamiento del PDF y los asocia a un trazo de calibración. */

export type PlanoDimension = {
  meters: number
  label: string
  x: number
  y: number
}

export type PdfTextRun = {
  str: string
  x: number
  y: number
  w: number
  h: number
}

const DIM_MIN_M = 0.4
const DIM_MAX_M = 80

/** Interpreta una cota de plano (4.40, 4,40, 3.20 m). */
export function parseDimensionLabel(
  raw: string,
): { meters: number; label: string } | null {
  const s = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/m$/i, '')
    .replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < DIM_MIN_M || n > DIM_MAX_M) return null
  if (!s.includes('.') && (n < 2 || n > 40)) return null
  const label = s.includes('.') ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : String(n)
  return { meters: n, label }
}

export function mergePdfTextRuns(runs: PdfTextRun[]): PdfTextRun[] {
  const sorted = [...runs]
    .filter((r) => r.str.trim())
    .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x))
  const out: PdfTextRun[] = []
  for (const r of sorted) {
    const prev = out[out.length - 1]
    if (!prev) {
      out.push({ ...r })
      continue
    }
    const gap = r.x - (prev.x + prev.w)
    const sameLine = Math.abs(r.y - prev.y) <= Math.max(prev.h, r.h, 6) * 0.7
    if (sameLine && gap >= -2 && gap <= Math.max(prev.h, r.h, 8) * 0.9) {
      prev.str += r.str
      prev.w = Math.max(prev.x + prev.w, r.x + r.w) - prev.x
      prev.h = Math.max(prev.h, r.h)
      prev.y = Math.min(prev.y, r.y)
      continue
    }
    out.push({ ...r })
  }
  return out
}

function runsToDimensions(
  runs: PdfTextRun[],
  pageW: number,
  pageH: number,
): PlanoDimension[] {
  if (!(pageW > 0) || !(pageH > 0)) return []
  const merged = mergePdfTextRuns(runs)
  const dims: PlanoDimension[] = []
  const seen = new Set<string>()
  for (const run of merged) {
    const re = /\d+(?:[.,]\d+)?/g
    let m: RegExpExecArray | null
    while ((m = re.exec(run.str))) {
      const parsed = parseDimensionLabel(m[0])
      if (!parsed) continue
      const cx = (run.x + run.w / 2) / pageW
      const cy = (run.y + run.h / 2) / pageH
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1) continue
      const key = `${parsed.meters.toFixed(2)}:${cx.toFixed(3)}:${cy.toFixed(3)}`
      if (seen.has(key)) continue
      seen.add(key)
      dims.push({
        meters: parsed.meters,
        label: parsed.label,
        x: Math.round(cx * 1000) / 1000,
        y: Math.round(cy * 1000) / 1000,
      })
    }
  }
  return dims
}

export function distPointToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Cota más cercana al trazo (típica: número junto a la línea de dimensión). */
export function pickDimensionForSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  dims: PlanoDimension[],
  maxDist = 0.07,
): PlanoDimension | null {
  const segLen = Math.hypot(b.x - a.x, b.y - a.y)
  if (segLen < 0.012 || dims.length === 0) return null
  let best: PlanoDimension | null = null
  let bestDist = maxDist
  for (const d of dims) {
    const dist = distPointToSegment(d, a, b)
    if (dist < bestDist) {
      bestDist = dist
      best = d
    }
  }
  return best
}

export function rotatePlanoDimensions(
  dims: PlanoDimension[],
  dir: 'cw' | 'ccw',
): PlanoDimension[] {
  return dims.map((d) =>
    dir === 'cw'
      ? { ...d, x: Math.round((1 - d.y) * 1000) / 1000, y: Math.round(d.x * 1000) / 1000 }
      : { ...d, x: Math.round(d.y * 1000) / 1000, y: Math.round((1 - d.x) * 1000) / 1000 },
  )
}

export async function extractPdfDimensionsFromBytes(
  data: Uint8Array,
): Promise<PlanoDimension[]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise
  try {
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const runs: PdfTextRun[] = []
    for (const raw of content.items) {
      const item = raw as {
        str?: string
        transform?: number[]
        width?: number
        height?: number
      }
      if (!item.str || !item.transform) continue
      const xPdf = item.transform[4] ?? 0
      const yPdf = item.transform[5] ?? 0
      const pt =
        typeof viewport.convertToViewportPoint === 'function'
          ? viewport.convertToViewportPoint(xPdf, yPdf)
          : [xPdf, viewport.height - yPdf]
      const h = item.height || 8
      runs.push({
        str: item.str,
        x: pt[0] ?? 0,
        y: (pt[1] ?? 0) - h,
        w: item.width || Math.max(h, 4),
        h,
      })
    }
    return runsToDimensions(runs, viewport.width, viewport.height)
  } finally {
    await doc.destroy()
  }
}

/** Expuesto para tests: cotas a partir de runs ya en espacio de página. */
export function dimensionsFromPageRuns(
  runs: PdfTextRun[],
  pageW: number,
  pageH: number,
): PlanoDimension[] {
  return runsToDimensions(runs, pageW, pageH)
}
