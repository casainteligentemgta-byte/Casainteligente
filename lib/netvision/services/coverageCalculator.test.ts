import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  preferredVisionBand,
  visionBandForDistance,
  visionBandRank,
} from './coverageCalculator'

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
