import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DesignCamera } from '../types'
import {
  buildVisionSpectrum,
  preferredVisionBand,
  visionBandForDistance,
  visionBandRank,
} from './coverageCalculator'

function testCam(partial: Partial<DesignCamera> & Pick<DesignCamera, 'id' | 'x' | 'yawDeg'>): DesignCamera {
  return {
    label: partial.id,
    y: 0.5,
    modelId: 'hik-ds2cd2143',
    mountHeightM: 3,
    fovDeg: 180,
    fovLeftDeg: 90,
    fovRightDeg: 90,
    rangeM: 20,
    ...partial,
  }
}

describe('visionBandRank', () => {
  it('verde gana a naranja y naranja a rojo', () => {
    assert.ok(visionBandRank('green') > visionBandRank('yellow'))
    assert.ok(visionBandRank('yellow') > visionBandRank('red'))
  })
})

describe('preferredVisionBand', () => {
  it('en un solape muestra la mejor detección', () => {
    assert.equal(preferredVisionBand('green', 'red'), 'green')
    assert.equal(preferredVisionBand('red', 'green'), 'green')
    assert.equal(preferredVisionBand('yellow', 'red'), 'yellow')
    assert.equal(preferredVisionBand('red', 'yellow'), 'yellow')
    assert.equal(preferredVisionBand('green', 'yellow'), 'green')
  })
})

describe('visionBandForDistance', () => {
  it('parte el alcance en verde / naranja / rojo', () => {
    assert.equal(visionBandForDistance(3, 10), 'green')
    assert.equal(visionBandForDistance(5.5, 10), 'yellow')
    assert.equal(visionBandForDistance(9, 10), 'red')
  })
})

describe('buildVisionSpectrum overlap', () => {
  it('si una cámara ve verde y la otra rojo, la celda queda verde', () => {
    const scale = { metersPerNormX: 20, metersPerNormY: 20, calibrated: true }
    const cells = buildVisionSpectrum(
      [
        testCam({ id: 'a', x: 0.05, yawDeg: 0 }),
        testCam({ id: 'b', x: 0.95, yawDeg: 180 }),
      ],
      scale,
      'day',
      [],
      20,
    )
    const inFrontOfA = cells.find((c) => c.x > 0.08 && c.x < 0.22 && c.y > 0.45 && c.y < 0.55)
    const inFrontOfB = cells.find((c) => c.x > 0.78 && c.x < 0.92 && c.y > 0.45 && c.y < 0.55)
    assert.equal(inFrontOfA?.band, 'green')
    assert.equal(inFrontOfB?.band, 'green')
  })
})
