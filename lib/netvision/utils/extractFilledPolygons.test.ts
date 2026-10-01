/**
 * Ejecutar: npx tsx --test lib/netvision/utils/extractFilledPolygons.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pickWallColor } from './detectWallsGeometry'
import {
  extractFilledPolygonsFromOperatorList,
  groupPolygonsByColor,
  PDFJS_OPS as OPS,
} from './extractFilledPolygons'
import { wallSegmentsFromGroups } from '../detectWallsFromPdf'

const VIEW = {
  width: 612,
  height: 792,
  transform: [1, 0, 0, -1, 0, 792] as [number, number, number, number, number, number],
}

describe('extractFilledPolygonsFromOperatorList', () => {
  it('agrupa rectángulos rellenos y elige el color de muro (gris alargado, no negro)', () => {
    const gray = [0.45, 0.45, 0.45]
    const black = [0, 0, 0]
    const opList = {
      fnArray: [
        OPS.setFillRGBColor,
        OPS.constructPath,
        OPS.fill,
        OPS.setFillRGBColor,
        OPS.constructPath,
        OPS.fill,
        OPS.setFillRGBColor,
        OPS.constructPath,
        OPS.fill,
        OPS.setFillRGBColor,
        OPS.constructPath,
        OPS.fill,
      ],
      argsArray: [
        gray,
        [[OPS.rectangle], [72, 72, 400, 8], [72, 72, 472, 80]],
        null,
        gray,
        [[OPS.rectangle], [72, 400, 400, 8], [72, 400, 472, 408]],
        null,
        gray,
        [[OPS.rectangle], [72, 72, 8, 336], [72, 72, 80, 408]],
        null,
        black,
        [[OPS.rectangle], [10, 10, 6, 6], [10, 10, 16, 16]],
        null,
      ],
    }

    const polys = extractFilledPolygonsFromOperatorList(opList, VIEW)
    assert.equal(polys.length, 4)
    const groups = groupPolygonsByColor(polys)
    const { color, score } = pickWallColor(groups)
    assert.equal(color, '(0.45, 0.45, 0.45)')
    assert.equal(score, 3)

    const detected = wallSegmentsFromGroups(groups, {
      width: VIEW.width,
      height: VIEW.height,
    })
    assert.equal(detected.color, '(0.45, 0.45, 0.45)')
    assert.ok(detected.walls.length >= 3, `esperaba ≥3 muros, hay ${detected.walls.length}`)
    // Muro inferior: y PDF 76 → canvas 792-76=716 → 716/792 ≈ 0.904
    const horizontal = detected.walls.filter((w) => Math.abs(w.y1 - w.y2) < 0.02)
    const vertical = detected.walls.filter((w) => Math.abs(w.x1 - w.x2) < 0.02)
    assert.ok(horizontal.length >= 2)
    assert.ok(vertical.length >= 1)
  })

  it('lee setFillRGBColor cuando pdf.js pasa args como objeto índice', () => {
    const opList = {
      fnArray: [OPS.setFillRGBColor, OPS.constructPath, OPS.fill],
      argsArray: [
        { 0: 115, 1: 115, 2: 115 },
        [[OPS.moveTo, OPS.lineTo, OPS.lineTo, OPS.lineTo, OPS.closePath], [0, 0, 0, 8, 400, 8, 400, 0], [0, 0, 400, 8]],
        null,
      ],
    }
    const polys = extractFilledPolygonsFromOperatorList(opList, VIEW)
    assert.equal(polys.length, 1)
    assert.equal(polys[0]!.color, '(0.451, 0.451, 0.451)')
  })

  it('aplica CTM (transform) antes del viewport', () => {
    const opList = {
      fnArray: [OPS.save, OPS.transform, OPS.setFillRGBColor, OPS.constructPath, OPS.fill, OPS.restore],
      argsArray: [
        null,
        [1, 0, 0, 1, 100, 0],
        [0.2, 0.2, 0.2],
        [[OPS.rectangle], [0, 100, 200, 6], [0, 100, 200, 106]],
        null,
        null,
      ],
    }
    const polys = extractFilledPolygonsFromOperatorList(opList, VIEW)
    assert.equal(polys.length, 1)
    const xs = polys[0]!.pts.map((p) => p[0])
    assert.ok(Math.min(...xs) >= 99 && Math.min(...xs) <= 101)
    assert.ok(Math.max(...xs) >= 299 && Math.max(...xs) <= 301)
  })
})
