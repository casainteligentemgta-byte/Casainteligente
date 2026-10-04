import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CALIB_MIN_SEGMENT_NORM,
  calibrationChecksOut,
  calibrationToScale,
  computePlanCalibration,
} from './scaleCalibration'

describe('computePlanCalibration', () => {
  it('10 m en un cuarto del plano → ancho 40 m y calibrated', () => {
    const r = computePlanCalibration({
      a: { x: 0.1, y: 0.5 },
      b: { x: 0.35, y: 0.5 },
      meters: 10,
      source: 'manual',
      label: '10',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(Math.abs(r.planWidthM - 40) < 1e-9)
    assert.equal(calibrationChecksOut(r), true)
    const scale = calibrationToScale(r)
    assert.equal(scale.calibrated, true)
    assert.ok(Math.abs(scale.metersPerNormX - 40) < 1e-9)
  })

  it('rechaza un trazo más corto que el umbral', () => {
    const r = computePlanCalibration({
      a: { x: 0.5, y: 0.5 },
      b: { x: 0.5 + CALIB_MIN_SEGMENT_NORM / 2, y: 0.5 },
      meters: 10,
      source: 'manual',
    })
    assert.deepEqual(r, { ok: false, reason: 'short' })
  })

  it('rechaza metros inválidos', () => {
    assert.equal(
      computePlanCalibration({
        a: { x: 0.1, y: 0.1 },
        b: { x: 0.5, y: 0.1 },
        meters: 0,
        source: 'manual',
      }).ok,
      false,
    )
  })

  it('una cota de 4.40 m a lo ancho del plano fija 4.40 m de ancho', () => {
    const r = computePlanCalibration({
      a: { x: 0, y: 0.4 },
      b: { x: 1, y: 0.4 },
      meters: 4.4,
      source: 'cota',
      label: '4.40',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(Math.abs(r.planWidthM - 4.4) < 1e-9)
    assert.equal(r.source, 'cota')
  })
})
