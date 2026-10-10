import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dimensionsFromPageRuns,
  distPointToSegment,
  mergePdfTextRuns,
  parseDimensionLabel,
  pickDimensionForSegment,
  rotatePlanoDimensions,
  rotatePlanoDimensionsQuarters,
} from './extractPdfDimensions'

describe('parseDimensionLabel', () => {
  it('acepta 4.40, 4,40 y 3.20 m', () => {
    assert.deepEqual(parseDimensionLabel('4.40'), { meters: 4.4, label: '4.40' })
    assert.deepEqual(parseDimensionLabel('4,40'), { meters: 4.4, label: '4.40' })
    assert.deepEqual(parseDimensionLabel('3.20 m'), { meters: 3.2, label: '3.20' })
  })

  it('rechaza números que no son cota de local', () => {
    assert.equal(parseDimensionLabel('2024'), null)
    assert.equal(parseDimensionLabel('1'), null)
    assert.equal(parseDimensionLabel('SALA'), null)
  })
})

describe('mergePdfTextRuns', () => {
  it('junta 4 + . + 40 en una sola cota', () => {
    const merged = mergePdfTextRuns([
      { str: '4', x: 10, y: 20, w: 5, h: 8 },
      { str: '.', x: 15, y: 20, w: 2, h: 8 },
      { str: '40', x: 17, y: 20, w: 8, h: 8 },
    ])
    assert.equal(merged.length, 1)
    assert.equal(merged[0]!.str, '4.40')
  })
})

describe('dimensionsFromPageRuns', () => {
  it('normaliza la cota al espacio 0–1', () => {
    const dims = dimensionsFromPageRuns(
      [{ str: '4.40', x: 50, y: 80, w: 20, h: 10 }],
      200,
      200,
    )
    assert.equal(dims.length, 1)
    assert.equal(dims[0]!.meters, 4.4)
    assert.ok(Math.abs(dims[0]!.x - 0.3) < 0.02)
    assert.ok(Math.abs(dims[0]!.y - 0.425) < 0.03)
  })
})

describe('pickDimensionForSegment', () => {
  it('elige la cota junto al trazo', () => {
    const dims = [
      { meters: 4.4, label: '4.40', x: 0.3, y: 0.21 },
      { meters: 12, label: '12', x: 0.8, y: 0.8 },
    ]
    const hit = pickDimensionForSegment({ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }, dims)
    assert.equal(hit?.meters, 4.4)
  })

  it('no inventa cota si el trazo está lejos', () => {
    const dims = [{ meters: 4.4, label: '4.40', x: 0.9, y: 0.9 }]
    assert.equal(
      pickDimensionForSegment({ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }, dims),
      null,
    )
  })
})

describe('distPointToSegment', () => {
  it('distancia perpendicular a un tramo horizontal', () => {
    const d = distPointToSegment({ x: 0.3, y: 0.25 }, { x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 })
    assert.ok(Math.abs(d - 0.05) < 1e-9)
  })
})

describe('rotatePlanoDimensions', () => {
  it('90° horario', () => {
    const next = rotatePlanoDimensions([{ meters: 3, label: '3', x: 0, y: 0 }], 'cw')
    assert.deepEqual(next[0], { meters: 3, label: '3', x: 1, y: 0 })
  })

  it('N cuartos horarios', () => {
    const start = [{ meters: 3, label: '3', x: 0, y: 0 }]
    assert.deepEqual(rotatePlanoDimensionsQuarters(start, 0)[0], start[0])
    assert.deepEqual(rotatePlanoDimensionsQuarters(start, 1)[0], {
      meters: 3,
      label: '3',
      x: 1,
      y: 0,
    })
    assert.deepEqual(rotatePlanoDimensionsQuarters(start, 2)[0], {
      meters: 3,
      label: '3',
      x: 1,
      y: 1,
    })
  })
})
