import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  rangeFromDistNorm,
  shortestDeltaDeg,
  snapToStep,
  symmetricFovFromYawDelta,
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
  it('iguala ambos lados y redondea a 5°', () => {
    const next = symmetricFovFromYawDelta(-47)
    assert.deepEqual(next, { fovLeftDeg: 45, fovRightDeg: 45, fovDeg: 90 })
  })

  it('no baja de 10° ni pasa de 85° por lado', () => {
    assert.equal(symmetricFovFromYawDelta(3).fovLeftDeg, 10)
    assert.equal(symmetricFovFromYawDelta(200).fovLeftDeg, 85)
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
