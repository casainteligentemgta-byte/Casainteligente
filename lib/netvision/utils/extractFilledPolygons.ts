/** Recorre el operator list de pdf.js y junta polígonos rellenos por color. */

import {
  AFFINE_IDENTITY,
  applyAffine,
  cloneAffine,
  multiplyAffine,
  stringifyFillColor,
  type Affine,
  type PdfPoint,
} from '@/lib/netvision/utils/detectWallsGeometry'

/** Códigos OPS de pdf.js 4.x (estables; no se renumeran). */
export const PDFJS_OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  setFillColor: 54,
  setFillColorN: 55,
  setFillGray: 57,
  setFillRGBColor: 59,
  setFillCMYKColor: 61,
  constructPath: 91,
  stroke: 20,
  closeStroke: 21,
} as const

export type PdfOperatorList = {
  fnArray: Array<number | string>
  argsArray: unknown[]
}

export type ViewportLike = {
  width: number
  height: number
  transform: Affine
}

export type FilledPolygon = {
  color: string
  pts: PdfPoint[]
}

export type PathArc = {
  pts: PdfPoint[]
}

const STROKE_OPS = new Set<number>([PDFJS_OPS.stroke, PDFJS_OPS.closeStroke])

const FILL_OPS = new Set<number>([
  PDFJS_OPS.fill,
  PDFJS_OPS.eoFill,
  PDFJS_OPS.fillStroke,
  PDFJS_OPS.eoFillStroke,
  PDFJS_OPS.closeFillStroke,
  PDFJS_OPS.closeEOFillStroke,
])

function asNumArray(v: unknown): number[] {
  if (Array.isArray(v)) {
    return v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  }
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>
    const keys = Object.keys(rec)
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      const out: number[] = []
      const n = keys.length
      for (let i = 0; i < n; i++) {
        const val = rec[String(i)]
        if (typeof val === 'number' && Number.isFinite(val)) out.push(val)
      }
      if (out.length === n) return out
    }
  }
  return []
}

function opCode(fn: number | string, nameToCode: Record<string, number>): number {
  if (typeof fn === 'number') return fn
  return nameToCode[fn] ?? -1
}

function buildNameToCode(ops: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(ops)) out[k] = v
  return out
}

function roundPt(x: number, y: number): PdfPoint {
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100]
}

type PathBuilder = {
  subpaths: PdfPoint[][]
  current: PdfPoint[]
  curveCount: number
}

function newPath(): PathBuilder {
  return { subpaths: [], current: [], curveCount: 0 }
}

function pushCurrent(path: PathBuilder) {
  if (path.current.length >= 2) path.subpaths.push(path.current)
  path.current = []
}

function parseConstructPath(args: unknown): { ops: number[]; coords: number[]; minMax: number[] } {
  if (!Array.isArray(args) || args.length === 0) {
    return { ops: [], coords: [], minMax: [] }
  }
  const ops = asNumArray(args[0])
  if (args.length >= 3) {
    return { ops, coords: asNumArray(args[1]), minMax: asNumArray(args[2]) }
  }
  const second = asNumArray(args[1])
  // v3: [ops, coords] · a veces [ops, minMax] (4 números).
  if (second.length === 4 && ops.length > 0 && ops[0] !== PDFJS_OPS.rectangle) {
    return { ops, coords: [], minMax: second }
  }
  return { ops, coords: second, minMax: [] }
}

function consumePathOps(
  path: PathBuilder,
  ops: number[],
  coords: number[],
  mapPt: (x: number, y: number) => PdfPoint,
) {
  let j = 0
  let x = 0
  let y = 0
  for (const op of ops) {
    if (op === PDFJS_OPS.rectangle) {
      pushCurrent(path)
      const rx = coords[j++] ?? 0
      const ry = coords[j++] ?? 0
      const rw = coords[j++] ?? 0
      const rh = coords[j++] ?? 0
      const xw = rx + rw
      const yh = ry + rh
      path.subpaths.push([mapPt(rx, ry), mapPt(xw, ry), mapPt(xw, yh), mapPt(rx, yh)])
      x = rx
      y = ry
      continue
    }
    if (op === PDFJS_OPS.moveTo) {
      pushCurrent(path)
      x = coords[j++] ?? 0
      y = coords[j++] ?? 0
      path.current = [mapPt(x, y)]
      continue
    }
    if (op === PDFJS_OPS.lineTo) {
      x = coords[j++] ?? 0
      y = coords[j++] ?? 0
      path.current.push(mapPt(x, y))
      continue
    }
    if (op === PDFJS_OPS.curveTo) {
      path.curveCount += 1
      j += 4
      x = coords[j++] ?? x
      y = coords[j++] ?? y
      path.current.push(mapPt(x, y))
      continue
    }
    if (op === PDFJS_OPS.curveTo2) {
      path.curveCount += 1
      j += 2
      x = coords[j++] ?? x
      y = coords[j++] ?? y
      path.current.push(mapPt(x, y))
      continue
    }
    if (op === PDFJS_OPS.curveTo3) {
      path.curveCount += 1
      x = coords[j + 2] ?? x
      y = coords[j + 3] ?? y
      j += 4
      path.current.push(mapPt(x, y))
      continue
    }
    if (op === PDFJS_OPS.closePath) {
      if (path.current.length >= 1) {
        const first = path.current[0]!
        const last = path.current[path.current.length - 1]!
        if (first[0] !== last[0] || first[1] !== last[1]) path.current.push(first)
      }
      pushCurrent(path)
    }
  }
  pushCurrent(path)
}

function bboxPolygon(minMax: number[], mapPt: (x: number, y: number) => PdfPoint): PdfPoint[] | null {
  if (minMax.length < 4) return null
  const [x0, y0, x1, y1] = minMax
  if (x0 == null || y0 == null || x1 == null || y1 == null) return null
  return [mapPt(x0, y0), mapPt(x1, y0), mapPt(x1, y1), mapPt(x0, y1)]
}

/**
 * Extrae polígonos rellenos y arcos trazados del operator list, en espacio viewport
 * (origen arriba-izquierda, igual que el canvas de pdf.js).
 */
export function extractPdfPrimitivesFromOperatorList(
  opList: PdfOperatorList,
  viewport: ViewportLike,
  ops: Record<string, number> = PDFJS_OPS,
): { polygons: FilledPolygon[]; arcs: PathArc[] } {
  const nameToCode = buildNameToCode(ops)
  const polygons: FilledPolygon[] = []
  const arcs: PathArc[] = []
  let fillColor = 'None'
  let ctm = cloneAffine(AFFINE_IDENTITY)
  const stack: Affine[] = []
  let path = newPath()

  const mapPt = (x: number, y: number): PdfPoint => {
    const user = applyAffine(ctm, x, y)
    const canvas = applyAffine(viewport.transform, user.x, user.y)
    return roundPt(canvas.x, canvas.y)
  }

  const emitFill = () => {
    pushCurrent(path)
    for (const pts of path.subpaths) {
      if (pts.length >= 3) polygons.push({ color: fillColor, pts })
    }
    path = newPath()
  }

  const emitStrokeArcs = () => {
    pushCurrent(path)
    if (path.curveCount > 0) {
      for (const pts of path.subpaths) {
        if (pts.length >= 3) arcs.push({ pts })
      }
    }
    path = newPath()
  }

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opCode(opList.fnArray[i]!, nameToCode)
    const args = opList.argsArray[i]

    if (fn === ops.save) {
      stack.push(cloneAffine(ctm))
      continue
    }
    if (fn === ops.restore) {
      ctm = stack.pop() ?? cloneAffine(AFFINE_IDENTITY)
      continue
    }
    if (fn === ops.transform) {
      const n = asNumArray(args)
      if (n.length >= 6) {
        ctm = multiplyAffine(ctm, [n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!])
      }
      continue
    }
    if (fn === ops.setFillRGBColor || fn === ops.setFillGray || fn === ops.setFillCMYKColor) {
      fillColor = stringifyFillColor(asNumArray(args))
      continue
    }
    if (fn === ops.setFillColor || fn === ops.setFillColorN) {
      const n = asNumArray(args)
      fillColor = n.length > 0 ? stringifyFillColor(n) : 'None'
      continue
    }
    if (fn === ops.constructPath) {
      const parsed = parseConstructPath(args)
      consumePathOps(path, parsed.ops, parsed.coords, mapPt)
      if (path.subpaths.length === 0 && path.current.length < 3) {
        const box = bboxPolygon(parsed.minMax, mapPt)
        if (box) path.subpaths.push(box)
      }
      continue
    }
    if (fn === ops.rectangle) {
      const n = asNumArray(args)
      consumePathOps(path, [ops.rectangle], n, mapPt)
      continue
    }
    if (fn === ops.moveTo) {
      const n = asNumArray(args)
      consumePathOps(path, [ops.moveTo], n, mapPt)
      continue
    }
    if (fn === ops.lineTo) {
      const n = asNumArray(args)
      consumePathOps(path, [ops.lineTo], n, mapPt)
      continue
    }
    if (fn === ops.closePath) {
      consumePathOps(path, [ops.closePath], [], mapPt)
      continue
    }
    if (FILL_OPS.has(fn)) {
      emitFill()
      continue
    }
    if (STROKE_OPS.has(fn) || fn === (ops.stroke as number) || fn === (ops.closeStroke as number)) {
      emitStrokeArcs()
      continue
    }
    if (fn === ops.endPath) {
      path = newPath()
    }
  }

  return { polygons, arcs }
}

export function extractFilledPolygonsFromOperatorList(
  opList: PdfOperatorList,
  viewport: ViewportLike,
  ops: Record<string, number> = PDFJS_OPS,
): FilledPolygon[] {
  return extractPdfPrimitivesFromOperatorList(opList, viewport, ops).polygons
}

export function groupPolygonsByColor(polys: FilledPolygon[]): Map<string, PdfPoint[][]> {
  const groups = new Map<string, PdfPoint[][]>()
  for (const p of polys) {
    const list = groups.get(p.color)
    if (list) list.push(p.pts)
    else groups.set(p.color, [p.pts])
  }
  return groups
}
