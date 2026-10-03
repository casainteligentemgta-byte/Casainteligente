/**
 * Ejecutar: npx tsx --test lib/netvision/utils/structureDraw.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  snapOrtho90,
  snapToStructureJoints,
  snapToStructureJointsAligned,
  structureLabelPrefix,
} from './structureDraw'

describe('snapOrtho90', () => {
  it('prioriza horizontal si |dx| >= |dy|', () => {
    assert.deepEqual(snapOrtho90({ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.32 }), {
      x: 0.5,
      y: 0.3,
    })
  })

  it('prioriza vertical si |dy| > |dx|', () => {
    assert.deepEqual(snapOrtho90({ x: 0.2, y: 0.3 }, { x: 0.21, y: 0.6 }), {
      x: 0.2,
      y: 0.6,
    })
  })
})

describe('snapToStructureJoints', () => {
  const walls = [{ x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.1 }]

  it('pega a un extremo cercano', () => {
    const hit = snapToStructureJoints({ x: 0.102, y: 0.103 }, walls)
    assert.deepEqual(hit, { x: 0.1, y: 0.1 })
  })

  it('deja el punto si no hay junta cerca', () => {
    const pt = { x: 0.7, y: 0.7 }
    assert.deepEqual(snapToStructureJoints(pt, walls), pt)
  })
})

describe('snapToStructureJointsAligned', () => {
  const walls = [
    { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.1 },
    { x1: 0.4, y1: 0.1, x2: 0.4, y2: 0.5 },
  ]

  it('cierra un muro horizontal contra la esquina sin romper 90°', () => {
    const from = { x: 0.1, y: 0.5 }
    const snapped = snapOrtho90(from, { x: 0.39, y: 0.52 })
    const joined = snapToStructureJointsAligned(from, snapped, walls)
    assert.deepEqual(joined, { x: 0.4, y: 0.5 })
  })
})

describe('structureLabelPrefix', () => {
  it('usa CON para concreto (no DRY)', () => {
    assert.equal(structureLabelPrefix('concrete'), 'CON')
    assert.equal(structureLabelPrefix('drywall'), 'DRY')
    assert.equal(structureLabelPrefix('glass'), 'VID')
  })
})
