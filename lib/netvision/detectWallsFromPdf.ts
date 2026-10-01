/** Detección de muros y aberturas desde un PDF vectorial (planos exportados de CAD). */

import type { DesignStructure, StructureMaterialId } from '@/lib/netvision/types'
import {
  pickWallColor,
  type PdfPoint,
  type WallSegment,
} from '@/lib/netvision/utils/detectWallsGeometry'
import {
  doorsFromArcs,
  mergeOpenings,
  openingsFromColoredFills,
  openingsFromWallGaps,
  segmentsFromColoredPolys,
  thickFromPolys,
} from '@/lib/netvision/utils/detectOpenings'
import {
  extractPdfPrimitivesFromOperatorList,
  groupPolygonsByColor,
  PDFJS_OPS,
  type ViewportLike,
} from '@/lib/netvision/utils/extractFilledPolygons'
import { clamp01 } from '@/lib/netvision/utils/geometryHelpers'

export type DetectWallsResult = {
  color: string | null
  score: number
  walls: WallSegment[]
  doors: WallSegment[]
  windows: WallSegment[]
  polygonCount: number
  page: { width: number; height: number }
}

const DEFAULT_MATERIAL: StructureMaterialId = 'block'
const MAX_DETECTED_WALLS = 250
const MAX_DETECTED_OPENINGS = 80

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  return pdfjs
}

function toNorm(seg: WallSegment, width: number, height: number): WallSegment | null {
  if (width <= 0 || height <= 0) return null
  const pageMin = Math.min(width, height)
  const x1 = clamp01(seg.x1 / width)
  const y1 = clamp01(seg.y1 / height)
  const x2 = clamp01(seg.x2 / width)
  const y2 = clamp01(seg.y2 / height)
  if (Math.hypot(x2 - x1, y2 - y1) < 0.004) return null
  const out: WallSegment = {
    x1: Math.round(x1 * 1000) / 1000,
    y1: Math.round(y1 * 1000) / 1000,
    x2: Math.round(x2 * 1000) / 1000,
    y2: Math.round(y2 * 1000) / 1000,
  }
  if (typeof seg.thickness === 'number' && pageMin > 0) {
    out.thickness = Math.round((seg.thickness / pageMin) * 1000) / 1000
  }
  return out
}

function mapNorm(segs: WallSegment[], page: { width: number; height: number }): WallSegment[] {
  const out: WallSegment[] = []
  for (const s of segs) {
    const n = toNorm(s, page.width, page.height)
    if (n) out.push(n)
  }
  return out
}

export function wallSegmentsFromGroups(
  groups: Map<string, PdfPoint[][]>,
  page: { width: number; height: number },
  arcs: PdfPoint[][] = [],
): DetectWallsResult {
  const { color, score } = pickWallColor(groups)
  const polys = color ? groups.get(color) ?? [] : []
  const pageMin = Math.min(page.width, page.height)
  const minLonger = pageMin * 0.02
  const maxShorter = pageMin * 0.12
  const thickWalls = thickFromPolys(polys, { minLonger, maxShorter })
  const colored = segmentsFromColoredPolys(groups, color, { minLonger, maxShorter, pageMin })
  const gap = openingsFromWallGaps(thickWalls, { glassSegs: colored.glass, pageMin })
  const fills = openingsFromColoredFills(thickWalls, colored.glass, colored.wood, pageMin)
  const arcDoors = doorsFromArcs(arcs, thickWalls, pageMin)
  const openings = mergeOpenings(gap, fills, arcDoors)

  const walls = mapNorm(thickWalls, page)
  walls.sort(
    (a, b) =>
      Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1),
  )

  return {
    color,
    score,
    walls: walls.slice(0, MAX_DETECTED_WALLS),
    doors: mapNorm(openings.doors, page).slice(0, MAX_DETECTED_OPENINGS),
    windows: mapNorm(openings.windows, page).slice(0, MAX_DETECTED_OPENINGS),
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
    const viewport = page.getViewport({ scale: 1 }) as unknown as ViewportLike
    const opList = await page.getOperatorList()
    const primitives = extractPdfPrimitivesFromOperatorList(
      { fnArray: opList.fnArray as number[], argsArray: opList.argsArray },
      {
        width: viewport.width,
        height: viewport.height,
        transform: viewport.transform as ViewportLike['transform'],
      },
      (pdfjs.OPS as unknown as Record<string, number>) ?? PDFJS_OPS,
    )
    const groups = groupPolygonsByColor(primitives.polygons)
    return wallSegmentsFromGroups(
      groups,
      { width: viewport.width, height: viewport.height },
      primitives.arcs.map((a) => a.pts),
    )
  } finally {
    await doc.destroy()
  }
}

function labelPrefix(materialId: StructureMaterialId): string {
  if (materialId === 'door') return 'PUE'
  if (materialId === 'window' || materialId === 'glass') return 'VEN'
  if (materialId === 'block') return 'BLO'
  if (materialId === 'concrete') return 'CON'
  return 'DRY'
}

export function structuresFromWallDetection(
  result: DetectWallsResult,
  opts?: {
    materialId?: StructureMaterialId
    makeId?: () => string
  },
): DesignStructure[] {
  const wallMaterial = opts?.materialId ?? DEFAULT_MATERIAL
  const makeId =
    opts?.makeId ??
    (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`)

  const push = (
    segs: WallSegment[],
    materialId: StructureMaterialId,
  ): DesignStructure[] => {
    const prefix = labelPrefix(materialId)
    return segs.map((w, i) => ({
      id: makeId(),
      label: `${prefix}-${String(i + 1).padStart(2, '0')}`,
      materialId,
      x1: w.x1,
      y1: w.y1,
      x2: w.x2,
      y2: w.y2,
    }))
  }

  return [
    ...push(result.walls, wallMaterial),
    ...push(result.doors ?? [], 'door'),
    ...push(result.windows ?? [], 'window'),
  ]
}

export function summarizePdfDetection(result: DetectWallsResult): string {
  const nW = result.walls.length
  const nD = (result.doors ?? []).length
  const nV = (result.windows ?? []).length
  if (nW + nD + nV === 0) {
    return 'PDF cargado. No se detectaron muros ni aberturas (¿es un escaneo?). Dibuja en Muros.'
  }
  const bits: string[] = []
  if (nW) bits.push(`${nW} muro${nW === 1 ? '' : 's'}`)
  if (nD) bits.push(`${nD} puerta${nD === 1 ? '' : 's'}`)
  if (nV) bits.push(`${nV} ventana${nV === 1 ? '' : 's'}`)
  return `Se detectaron ${bits.join(', ')} del PDF vectorial. Muros: bloque. Revisa el material en Muros si hace falta.`
}
