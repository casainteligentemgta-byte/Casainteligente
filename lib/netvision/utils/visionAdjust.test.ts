import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  rangeFromDistNorm,
  shortestDeltaDeg,
  snapToStep,
  symmetricFovFromYawDelta,
  visionPatchFromPointer,
  wrapDeg360,
} from './visionAdjust'

describe('wrapDeg360', () => {
  it('normaliza negativos y >360', () => {
    assert.equal(wrapDeg360(-90), 270)
    assert.equal(wrapDeg360(370), 10)
  })
})

describe('shortestDeltaDeg', () => {
  it('toma el camino corto', () => {
    assert.equal(shortestDeltaDeg(10, 350), -20)
    assert.equal(shortestDeltaDeg(350, 10), 20)
  })
})

describe('symmetricFovFromYawDelta', () => {
  it('iguala ambos lados y redondea al paso', () => {
    const next = symmetricFovFromYawDelta(-47, 5)
    assert.deepEqual(next, { fovLeftDeg: 45, fovRightDeg: 45, fovDeg: 90 })
  })

  it('no baja de 10° ni pasa de 85° por lado', () => {
    assert.equal(symmetricFovFromYawDelta(3).fovLeftDeg, 10)
    assert.equal(symmetricFovFromYawDelta(200).fovLeftDeg, 85)
  })
})

describe('visionPatchFromPointer', () => {
  it('el asa central solo gira, no cambia el alcance', () => {
    const patch = visionPatchFromPointer({
      mode: 'yaw',
      camX: 0.4,
      camY: 0.5,
      pointerX: 0.7,
      pointerY: 0.5,
      yawDeg: 0,
      avgMPerNorm: 40,
    })
    assert.equal(patch.yawDeg, 0)
    assert.equal(patch.rangeM, undefined)
  })

  it('el asa de alcance solo estira', () => {
    const patch = visionPatchFromPointer({
      mode: 'range',
      camX: 0.4,
      camY: 0.5,
      pointerX: 0.7,
      pointerY: 0.5,
      yawDeg: 90,
      avgMPerNorm: 40,
    })
    assert.equal(patch.rangeM, 12)
    assert.equal(patch.yawDeg, undefined)
  })

  it('el asa lateral abre los dos lados', () => {
    const patch = visionPatchFromPointer({
      mode: 'fov',
      camX: 0.5,
      camY: 0.5,
      pointerX: 0.5,
      pointerY: 0.2,
      yawDeg: 0,
      avgMPerNorm: 40,
    })
    assert.equal(patch.fovLeftDeg, patch.fovRightDeg)
    assert.ok((patch.fovDeg ?? 0) >= 20)
  })
})

describe('rangeFromDistNorm', () => {
  it('convierte distancia normalizada a metros', () => {
    assert.equal(rangeFromDistNorm(0.5, 40), 20)
  })
})

describe('snapToStep', () => {
  it('redondea al paso', () => {
    assert.equal(snapToStep(47, 5), 45)
  })
})
