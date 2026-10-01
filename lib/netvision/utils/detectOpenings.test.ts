/**
 * Ejecutar: npx tsx --test lib/netvision/utils/detectOpenings.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  fillColorRole,
  mergeOpenings,
  openingsFromColoredFills,
  openingsFromWallGaps,
  type ThickSegment,
} from './detectOpenings'

describe('fillColorRole', () => {
  it('clasifica cian/azul como vidrio y marrón como madera', () => {
    assert.equal(fillColorRole('(0.4, 0.75, 0.9)'), 'glass')
    assert.equal(fillColorRole('(0.55, 0.32, 0.12)'), 'wood')
    assert.equal(fillColorRole('(0.45, 0.45, 0.45)'), 'neutral')
    assert.equal(fillColorRole('0'), 'skip')
  })
})

describe('openingsFromWallGaps', () => {
  it('un hueco en un muro colineal es puerta si no hay vidrio', () => {
    const walls: ThickSegment[] = [
      { x1: 0, y1: 10, x2: 40, y2: 10, thickness: 2 },
      { x1: 55, y1: 10, x2: 120, y2: 10, thickness: 2 },
    ]
    const { doors, windows } = openingsFromWallGaps(walls, { pageMin: 120 })
    assert.equal(windows.length, 0)
    assert.equal(doors.length, 1)
    assert.ok(Math.abs(doors[0]!.x1 - 40) < 0.5)
    assert.ok(Math.abs(doors[0]!.x2 - 55) < 0.5)
  })

  it('el mismo hueco con relleno de vidrio es ventana', () => {
    const walls: ThickSegment[] = [
      { x1: 0, y1: 10, x2: 40, y2: 10, thickness: 2 },
      { x1: 70, y1: 10, x2: 120, y2: 10, thickness: 2 },
    ]
    const glass: ThickSegment[] = [{ x1: 40, y1: 10, x2: 70, y2: 10, thickness: 2 }]
    const { doors, windows } = openingsFromWallGaps(walls, { glassSegs: glass, pageMin: 120 })
    assert.equal(doors.length, 0)
    assert.equal(windows.length, 1)
  })

  it('no inventa puerta en un muro continuo', () => {
    const walls: ThickSegment[] = [{ x1: 0, y1: 10, x2: 120, y2: 10, thickness: 2 }]
    const { doors, windows } = openingsFromWallGaps(walls, { pageMin: 120 })
    assert.equal(doors.length, 0)
    assert.equal(windows.length, 0)
  })
})

describe('openingsFromColoredFills', () => {
  it('un relleno cian alineado al muro cuenta como ventana', () => {
    const walls: ThickSegment[] = [{ x1: 0, y1: 10, x2: 120, y2: 10, thickness: 2 }]
    const glass: ThickSegment[] = [{ x1: 40, y1: 10.4, x2: 70, y2: 10.4, thickness: 1.5 }]
    const { windows, doors } = openingsFromColoredFills(walls, glass, [], 120)
    assert.equal(doors.length, 0)
    assert.equal(windows.length, 1)
  })
})

describe('mergeOpenings', () => {
  it('si puerta y ventana se solapan, gana la ventana', () => {
    const gap = {
      doors: [{ x1: 40, y1: 10, x2: 70, y2: 10 }],
      windows: [] as { x1: number; y1: number; x2: number; y2: number }[],
    }
    const fills = {
      doors: [] as { x1: number; y1: number; x2: number; y2: number }[],
      windows: [{ x1: 40, y1: 10, x2: 70, y2: 10 }],
    }
    const merged = mergeOpenings(gap, fills, [])
    assert.equal(merged.windows.length, 1)
    assert.equal(merged.doors.length, 0)
  })
})
