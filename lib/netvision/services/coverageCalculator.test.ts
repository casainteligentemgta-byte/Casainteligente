import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DesignCamera } from '../types'
import {
  buildCoverageSectors,
  buildVisionSpectrum,
  coverageBandPolygons,
  preferredVisionBand,
  visionBandForDistance,
  visionBandRank,
  visionBandRangesM,
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
  it('parte el alcance de ficha en verde / naranja / rojo', () => {
    assert.equal(visionBandForDistance(3, 10), 'green')
    assert.equal(visionBandForDistance(5.5, 10), 'yellow')
    assert.equal(visionBandForDistance(9, 10), 'red')
  })

  it('estirar el cono no alarga el verde: 3 m siguen verdes', () => {
    assert.equal(visionBandForDistance(3, 10, 10), 'green')
    assert.equal(visionBandForDistance(3, 50, 10), 'green')
    assert.equal(visionBandForDistance(5.5, 50, 10), 'yellow')
    assert.equal(visionBandForDistance(8, 50, 10), 'red')
  })
})

describe('visionBandRangesM', () => {
  it('verde y amarillo quedan fijos al estirar', () => {
    const a = visionBandRangesM(10, 10)
    const b = visionBandRangesM(50, 10)
    assert.equal(a.greenMaxM, 4)
    assert.equal(b.greenMaxM, 4)
    assert.equal(a.yellowMaxM, 7)
    assert.equal(b.yellowMaxM, 7)
    assert.equal(a.redMaxM, 10)
    assert.equal(b.redMaxM, 50)
  })
})

describe('buildVisionSpectrum stretch', () => {
  it('con cono largo el verde no cubre decenas de metros', () => {
    const scale = { metersPerNormX: 100, metersPerNormY: 100, calibrated: true }
    // hik-ds2cd2143: 25 m día → verde 10 m, amarillo 17.5 m
    const cells = buildVisionSpectrum(
      [testCam({ id: 'a', x: 0.1, yawDeg: 0, rangeM: 80 })],
      scale,
      'day',
      [],
      40,
    )
    const near5m = cells.find(
      (c) => c.x > 0.14 && c.x < 0.16 && c.y > 0.48 && c.y < 0.52,
    )
    const far40m = cells.find(
      (c) => c.x > 0.48 && c.x < 0.52 && c.y > 0.48 && c.y < 0.52,
    )
    assert.equal(near5m?.band, 'green')
    assert.equal(far40m?.band, 'red')
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

describe('inclinación recorta el piso bajo la cámara', () => {
  it('con tilt 20° la celda pegada al pin no tiene espectro', () => {
    const scale = { metersPerNormX: 40, metersPerNormY: 40, calibrated: true }
    const cells = buildVisionSpectrum(
      [
        testCam({
          id: 'a',
          x: 0.5,
          yawDeg: 0,
          fovDeg: 90,
          fovLeftDeg: 45,
          fovRightDeg: 45,
          rangeM: 25,
          mountHeightM: 3,
          tiltDeg: 20,
        }),
      ],
      scale,
      'day',
      [],
      40,
    )
    const underPin = cells.find(
      (c) => c.x > 0.48 && c.x < 0.52 && c.y > 0.48 && c.y < 0.52,
    )
    const ahead8m = cells.find(
      (c) => c.x > 0.68 && c.x < 0.72 && c.y > 0.48 && c.y < 0.52,
    )
    assert.equal(underPin, undefined)
    assert.ok(ahead8m?.band, 'debe cubrir ~8 m al frente')
  })
})

describe('coverageBandPolygons', () => {
  it('verde y amarillo son polígonos con al menos 3 puntos', () => {
    const polys = coverageBandPolygons({
      cx: 0.4,
      cy: 0.5,
      startAngleRad: -Math.PI / 4,
      endAngleRad: Math.PI / 4,
      innerRadiusNorm: 0,
      greenRadiusNorm: 0.08,
      yellowRadiusNorm: 0.14,
      structures: [],
    })
    assert.ok((polys.greenPolygon?.length ?? 0) >= 3)
    assert.ok((polys.yellowPolygon?.length ?? 0) >= 3)
  })

  it('sin radio verde no genera polígono verde', () => {
    const polys = coverageBandPolygons({
      cx: 0.5,
      cy: 0.5,
      startAngleRad: 0,
      endAngleRad: Math.PI / 2,
      innerRadiusNorm: 0.1,
      greenRadiusNorm: 0.05,
      yellowRadiusNorm: 0.2,
      structures: [],
    })
    assert.equal(polys.greenPolygon, undefined)
    assert.ok((polys.yellowPolygon?.length ?? 0) >= 3)
  })
})

describe('buildCoverageSectors band polygons', () => {
  it('incluye polígonos de semáforo para rellenar el cono', () => {
    const scale = { metersPerNormX: 40, metersPerNormY: 20, calibrated: true }
    const sectors = buildCoverageSectors(
      [
        testCam({
          id: 'a',
          x: 0.3,
          yawDeg: 0,
          fovDeg: 90,
          fovLeftDeg: 45,
          fovRightDeg: 45,
          rangeM: 20,
          mountHeightM: 2.8,
          tiltDeg: 0,
        }),
      ],
      scale,
      'day',
      [],
    )
    assert.equal(sectors.length, 1)
    const s = sectors[0]!
    assert.ok((s.polygon?.length ?? 0) >= 3)
    assert.ok((s.greenPolygon?.length ?? 0) >= 3)
    assert.ok((s.yellowPolygon?.length ?? 0) >= 3)
    assert.ok((s.greenRadiusNorm ?? 0) < (s.yellowRadiusNorm ?? 0))
    assert.ok((s.yellowRadiusNorm ?? 0) <= s.radiusNorm + 1e-9)
  })
})
