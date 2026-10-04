import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  WALL_MASONRY_COLOR,
  isMasonryWall,
  structureLineGrosor,
  wallDrawnStrokePx,
  wallStrokeColor,
} from './structureStroke'

describe('structureStroke', () => {
  it('bloque y concreto son el mismo tipo de muro (mismo trazo)', () => {
    assert.equal(isMasonryWall('block'), true)
    assert.equal(isMasonryWall('concrete'), true)
    assert.equal(isMasonryWall('drywall'), false)
    const block = { id: 'block', color: '#111' }
    const concrete = { id: 'concrete', color: '#999' }
    assert.equal(wallStrokeColor(block, false, false), wallStrokeColor(concrete, false, false))
    assert.equal(wallStrokeColor(block, true, false), wallStrokeColor(concrete, true, false))
    assert.equal(wallStrokeColor(block, true, true), wallStrokeColor(concrete, true, true))
    assert.equal(wallStrokeColor(block, false, false), WALL_MASONRY_COLOR)
  })

  it('el mismo grosor produce el mismo px en bloque y concreto', () => {
    assert.equal(wallDrawnStrokePx(0, false), wallDrawnStrokePx(0, false))
    assert.equal(wallDrawnStrokePx(50, false), wallDrawnStrokePx(50, false))
    assert.ok(wallDrawnStrokePx(100, false) > wallDrawnStrokePx(0, false))
    assert.ok(wallDrawnStrokePx(50, true) > wallDrawnStrokePx(50, false))
  })

  it('grosor por línea: usa el del muro o 50', () => {
    assert.equal(structureLineGrosor({ grosor: 80 }), 80)
    assert.equal(structureLineGrosor({}), 50)
    assert.equal(structureLineGrosor(null), 50)
  })
})
