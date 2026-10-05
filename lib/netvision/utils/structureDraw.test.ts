/**
 * Ejecutar: npx tsx --test lib/netvision/utils/structureDraw.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceStructureDraw,
  snapCalibrationPoint,
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

describe('snapCalibrationPoint', () => {
  const walls = [
    { x1: 0.1, y1: 0.2, x2: 0.6, y2: 0.2 },
    { x1: 0.6, y1: 0.2, x2: 0.6, y2: 0.7 },
  ]

  it('el primer extremo imanta a una esquina de muro', () => {
    assert.deepEqual(
      snapCalibrationPoint(null, { x: 0.102, y: 0.203 }, walls),
      { x: 0.1, y: 0.2 },
    )
  })

  it('un trazo casi horizontal se clava a 90°', () => {
    const b = snapCalibrationPoint({ x: 0.1, y: 0.2 }, { x: 0.55, y: 0.22 }, walls)
    assert.equal(b.y, 0.2)
    assert.ok(b.x > 0.5)
  })

  it('un trazo en diagonal se deja libre', () => {
    const to = { x: 0.4, y: 0.5 }
    assert.deepEqual(snapCalibrationPoint({ x: 0.1, y: 0.2 }, to, []), to)
  })
})

describe('structureLabelPrefix', () => {
  it('usa CON para concreto (no DRY)', () => {
    assert.equal(structureLabelPrefix('concrete'), 'CON')
    assert.equal(structureLabelPrefix('drywall'), 'DRY')
    assert.equal(structureLabelPrefix('block'), 'BLO')
    assert.equal(structureLabelPrefix('glass'), 'VID')
  })
})

describe('advanceStructureDraw', () => {
  it('el primer clic solo deja el origen', () => {
    const next = advanceStructureDraw(null, { x: 0.2, y: 0.3 }, [])
    assert.equal(next.type, 'start')
    if (next.type === 'start') {
      assert.deepEqual(next.draft, { x: 0.2, y: 0.3 })
    }
  })

  it('el segundo clic graba el tramo ortogonal (bloque/concreto)', () => {
    const start = advanceStructureDraw(null, { x: 0.2, y: 0.3 }, [])
    assert.equal(start.type, 'start')
    if (start.type !== 'start') return
    const next = advanceStructureDraw(start.draft, { x: 0.55, y: 0.34 }, [])
    assert.equal(next.type, 'segment')
    if (next.type !== 'segment') return
    assert.equal(next.x1, 0.2)
    assert.equal(next.y1, 0.3)
    assert.equal(next.x2, 0.55)
    assert.equal(next.y2, 0.3)
    assert.deepEqual(next.nextDraft, { x: 0.55, y: 0.3 })
  })

  it('no pierde el origen si el segundo clic queda pegado', () => {
    const draft = { x: 0.4, y: 0.4 }
    const next = advanceStructureDraw(draft, { x: 0.401, y: 0.402 }, [])
    assert.equal(next.type, 'too-short')
    if (next.type === 'too-short') {
      assert.deepEqual(next.draft, draft)
    }
  })
})
