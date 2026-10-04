/**
 * Ejecutar: npx tsx --test lib/netvision/utils/cameraMount.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  clampMountHeightM,
  clampTiltDeg,
  projectGroundCoverage,
  verticalFovFromHorizontal,
} from './cameraMount'

describe('projectGroundCoverage', () => {
  it('con inclinación 0 conserva el alcance 2D (sin zona ciega)', () => {
    const g = projectGroundCoverage({
      heightM: 2.8,
      tiltDeg: 0,
      hFovDeg: 90,
      rangeM: 20,
    })
    assert.equal(g.nearM, 0)
    assert.equal(g.farM, 20)
  })

  it('al inclinar aparece zona ciega bajo la cámara y el fondo se recorta', () => {
    const g = projectGroundCoverage({
      heightM: 3,
      tiltDeg: 45,
      hFovDeg: 90,
      rangeM: 40,
    })
    assert.ok(g.nearM > 0.5, `near ${g.nearM}`)
    assert.ok(g.farM < 40, `far ${g.farM}`)
    assert.ok(g.farM > g.nearM)
  })

  it('a 90° mira al piso: cubre un círculo corto bajo la cámara', () => {
    const g = projectGroundCoverage({
      heightM: 2.8,
      tiltDeg: 90,
      hFovDeg: 90,
      rangeM: 25,
    })
    assert.ok(g.nearM < 1)
    assert.ok(g.farM < 8, `far ${g.farM}`)
    assert.ok(g.farM > 1)
  })
})

describe('clamps', () => {
  it('acota altura e inclinación', () => {
    assert.equal(clampMountHeightM(0), 1.5)
    assert.equal(clampMountHeightM(40), 12)
    assert.equal(clampTiltDeg(-10), 0)
    assert.equal(clampTiltDeg(120), 90)
  })
})

describe('verticalFovFromHorizontal', () => {
  it('el vertical es más estrecho que el horizontal en 16:9', () => {
    const v = verticalFovFromHorizontal(90)
    assert.ok(v > 40 && v < 70, `vFOV ${v}`)
  })
})
