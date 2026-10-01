/**
 * Ejecutar: npx tsx --test lib/netvision/utils/detectWallsGeometry.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  elongation,
  isSkippedFillColor,
  pickWallColor,
  polygonToCenterline,
  polygonsToWallSegments,
  shapeStats,
  stringifyFillColor,
} from './detectWallsGeometry'

describe('shapeStats / elongation', () => {
  it('un rectángulo 100×10 tiene elongación 10', () => {
    const pts: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 10],
      [0, 10],
    ]
    assert.equal(shapeStats(pts).longer, 100)
    assert.equal(shapeStats(pts).shorter, 10)
    assert.equal(elongation(pts), 10)
  })

  it('un cuadrado no cuenta como muro (elongación 1)', () => {
    const pts: [number, number][] = [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ]
    assert.equal(elongation(pts), 1)
  })
})

describe('stringifyFillColor / isSkippedFillColor', () => {
  it('serializa RGB 0–1 al estilo pdfplumber', () => {
    assert.equal(stringifyFillColor([0.45, 0.45, 0.45]), '(0.45, 0.45, 0.45)')
  })

  it('normaliza RGB 0–255', () => {
    assert.equal(stringifyFillColor([0, 0, 0]), '(0, 0, 0)')
    assert.equal(stringifyFillColor([255, 0, 0]), '(1, 0, 0)')
  })

  it('salta negro, 0 y None (texto, flechas, bloques CAD)', () => {
    assert.equal(isSkippedFillColor('(0.0, 0.0, 0.0)'), true)
    assert.equal(isSkippedFillColor('0'), true)
    assert.equal(isSkippedFillColor('None'), true)
    assert.equal(isSkippedFillColor('(0.45, 0.45, 0.45)'), false)
  })
})

describe('pickWallColor', () => {
  it('elige el color con más polígonos alargados y ignora el negro', () => {
    const wall: [number, number][] = [
      [0, 0],
      [80, 0],
      [80, 4],
      [0, 4],
    ]
    const blob: [number, number][] = [
      [0, 0],
      [30, 0],
      [30, 30],
      [0, 30],
    ]
    const black: [number, number][] = [
      [0, 0],
      [200, 0],
      [200, 2],
      [0, 2],
    ]
    const { color, score } = pickWallColor({
      '(0.45, 0.45, 0.45)': [wall, wall, wall],
      '(1, 0, 0)': [blob, blob],
      '0': [black, black, black, black],
    })
    assert.equal(color, '(0.45, 0.45, 0.45)')
    assert.equal(score, 3)
  })
})

describe('polygonToCenterline', () => {
  it('en un muro horizontal une los puntos medios de los lados cortos', () => {
    const seg = polygonToCenterline([
      [0, 0],
      [100, 0],
      [100, 10],
      [0, 10],
    ])
    assert.ok(seg)
    assert.equal(seg!.x1, 0)
    assert.equal(seg!.x2, 100)
    assert.equal(seg!.y1, 5)
    assert.equal(seg!.y2, 5)
  })

  it('en un muro vertical usa el eje largo vertical', () => {
    const seg = polygonToCenterline([
      [2, 0],
      [8, 0],
      [8, 50],
      [2, 50],
    ])
    assert.ok(seg)
    assert.equal(seg!.x1, 5)
    assert.equal(seg!.x2, 5)
    assert.equal(seg!.y1, 0)
    assert.equal(seg!.y2, 50)
  })
})

describe('polygonsToWallSegments', () => {
  it('descarta cuadrados y conserva el eje del muro delgado', () => {
    const segs = polygonsToWallSegments(
      [
        [
          [0, 0],
          [40, 0],
          [40, 40],
          [0, 40],
        ],
        [
          [0, 0],
          [80, 0],
          [80, 4],
          [0, 4],
        ],
      ],
      { minLonger: 10 },
    )
    assert.equal(segs.length, 1)
    assert.equal(segs[0]!.x1, 0)
    assert.equal(segs[0]!.x2, 80)
  })
})
