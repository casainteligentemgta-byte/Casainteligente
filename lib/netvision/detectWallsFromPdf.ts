/** Detección de muros desde un PDF vectorial (planos exportados de CAD). */

import type { DesignStructure, StructureMaterialId } from '@/lib/netvision/types'
import {
  pickWallColor,
  polygonsToWallSegments,
  type PdfPoint,
  type WallSegment,
} from '@/lib/netvision/utils/detectWallsGeometry'
import {
  extractFilledPolygonsFromOperatorList,
  groupPolygonsByColor,
  PDFJS_OPS,
  type ViewportLike,
} from '@/lib/netvision/utils/extractFilledPolygons'
import { clamp01 } from '@/lib/netvision/utils/geometryHelpers'

export type DetectWallsResult = {
  color: string | null
  score: number
  walls: WallSegment[]
  polygonCount: number
  page: { width: number; height: number }
}

const DEFAULT_MATERIAL: StructureMaterialId = 'block'

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  return pdfjs
}

function toNorm(seg: WallSegment, width: number, height: number): WallSegment | null {
  if (width <= 0 || height <= 0) return null
  const x1 = clamp01(seg.x1 / width)
  const y1 = clamp01(seg.y1 / height)
  const x2 = clamp01(seg.x2 / width)
  const y2 = clamp01(seg.y2 / height)
  if (Math.hypot(x2 - x1, y2 - y1) < 0.004) return null
  return {
    x1: Math.round(x1 * 1000) / 1000,
    y1: Math.round(y1 * 1000) / 1000,
    x2: Math.round(x2 * 1000) / 1000,
    y2: Math.round(y2 * 1000) / 1000,
  }
}

const MAX_DETECTED_WALLS = 250

export function wallSegmentsFromGroups(
  groups: Map<string, PdfPoint[][]>,
  page: { width: number; height: number },
): DetectWallsResult {
  const { color, score } = pickWallColor(groups)
  const polys = color ? groups.get(color) ?? [] : []
  const raw = polygonsToWallSegments(polys, {
    minLonger: Math.min(page.width, page.height) * 0.02,
    maxShorter: Math.min(page.width, page.height) * 0.12,
  })
  const walls: WallSegment[] = []
  for (const seg of raw) {
    const n = toNorm(seg, page.width, page.height)
    if (n) walls.push(n)
  }
  walls.sort(
    (a, b) =>
      Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1),
  )
  return {
    color,
    score,
    walls: walls.slice(0, MAX_DETECTED_WALLS),
    polygonCount: polys.length,
    page,
  }
}

export async function detectWallsFromPdfBytes(
  data: Uint8Array,
  pageNo = 0,
): Promise<DetectWallsResult> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise
  try {
    const page = await doc.getPage(pageNo + 1)
    const viewport = page.getViewport({ scale: 1 }) as ViewportLike
    const opList = await page.getOperatorList()
    const polys = extractFilledPolygonsFromOperatorList(
      { fnArray: opList.fnArray as number[], argsArray: opList.argsArray },
      { width: viewport.width, height: viewport.height, transform: viewport.transform as ViewportLike['transform'] },
      (pdfjs.OPS as unknown as Record<string, number>) ?? PDFJS_OPS,
    )
    const groups = groupPolygonsByColor(polys)
    return wallSegmentsFromGroups(groups, {
      width: viewport.width,
      height: viewport.height,
    })
  } finally {
    await doc.destroy()
  }
}

export function structuresFromWallDetection(
  result: DetectWallsResult,
  opts?: {
    materialId?: StructureMaterialId
    makeId?: () => string
  },
): DesignStructure[] {
  const materialId = opts?.materialId ?? DEFAULT_MATERIAL
  const makeId =
    opts?.makeId ??
    (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`)
  return result.walls.map((w, i) => ({
    id: makeId(),
    label: `BLO-${String(i + 1).padStart(2, '0')}`,
    materialId,
    x1: w.x1,
    y1: w.y1,
    x2: w.x2,
    y2: w.y2,
  }))
}
