import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'
import {
  CALIB_MIN_SEGMENT_NORM,
  ajustarEscalaSinCalibrar,
  aspectoValido,
  calibrationChecksOut,
  calibrationToScale,
  computePlanCalibration,
  estadoEscala,
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

describe('escala en planos que no son cuadrados', () => {
  // Plano de 40 m × 20 m: la imagen mide el doble de ancho que de alto (aspect 0,5).
  const ASPECT = 0.5
  const medir = (
    scale: { metersPerNormX: number; metersPerNormY: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => distMeters(a.x, a.y, b.x, b.y, scale.metersPerNormX, scale.metersPerNormY)

  it('calibrar con una cota horizontal da 40 × 20 m, no 40 × 40', () => {
    const r = computePlanCalibration({
      a: { x: 0.1, y: 0.5 },
      b: { x: 0.35, y: 0.5 },
      meters: 10,
      aspect: ASPECT,
      source: 'manual',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(Math.abs(r.planWidthM - 40) < 1e-9)
    assert.ok(Math.abs(r.planHeightM - 20) < 1e-9)
    assert.equal(calibrationChecksOut(r), true)
    const scale = calibrationToScale(r)
    assert.equal(scale.aspect, ASPECT)
    // El alto completo del plano mide 20 m (antes salían 40).
    assert.ok(Math.abs(medir(scale, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }) - 20) < 1e-9)
    assert.ok(Math.abs(medir(scale, { x: 0, y: 0.5 }, { x: 1, y: 0.5 }) - 40) < 1e-9)
  })

  it('calibrar con una cota vertical da el mismo resultado', () => {
    // 5 m de alto real = un cuarto del alto del plano (20 m).
    const r = computePlanCalibration({
      a: { x: 0.3, y: 0.2 },
      b: { x: 0.3, y: 0.45 },
      meters: 5,
      aspect: ASPECT,
      source: 'manual',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(Math.abs(r.planWidthM - 40) < 1e-9)
    assert.ok(Math.abs(r.planHeightM - 20) < 1e-9)
  })

  it('calibrar con un trazo en diagonal también cuadra', () => {
    // De (0.1, 0.2) a (0.4, 0.8): 12 m en horizontal y 12 m en vertical → 16,97 m.
    const a = { x: 0.1, y: 0.2 }
    const b = { x: 0.4, y: 0.8 }
    const r = computePlanCalibration({ a, b, meters: Math.hypot(12, 12), aspect: ASPECT, source: 'manual' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(Math.abs(r.planWidthM - 40) < 1e-9)
    const scale = calibrationToScale(r)
    // El propio trazo mide lo que se dijo, y cualquier otro también es coherente.
    assert.ok(Math.abs(medir(scale, a, b) - Math.hypot(12, 12)) < 1e-9)
    assert.ok(Math.abs(medir(scale, { x: 0, y: 0 }, { x: 1, y: 1 }) - Math.hypot(40, 20)) < 1e-9)
  })

  it('en un plano vertical (más alto que ancho) funciona igual', () => {
    const r = computePlanCalibration({
      a: { x: 0, y: 0.5 },
      b: { x: 1, y: 0.5 },
      meters: 8,
      aspect: 2.5,
      source: 'manual',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.ok(Math.abs(r.planWidthM - 8) < 1e-9)
    assert.ok(Math.abs(r.planHeightM - 20) < 1e-9)
  })

  it('sin proporción (o inválida) se comporta como antes: plano cuadrado', () => {
    for (const aspect of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = computePlanCalibration({ a: { x: 0, y: 0 }, b: { x: 0.25, y: 0 }, meters: 10, aspect, source: 'manual' })
      assert.equal(r.ok, true)
      if (!r.ok) return
      assert.ok(Math.abs(r.planWidthM - 40) < 1e-9)
      assert.ok(Math.abs(r.planHeightM - 40) < 1e-9)
    }
    assert.equal(aspectoValido(0.75), 0.75)
    assert.equal(aspectoValido('x'), 1)
  })

  it('reconoce una calibración antigua en un plano alargado', () => {
    const antigua = { metersPerNormX: 40, metersPerNormY: 40, calibrated: true }
    assert.equal(estadoEscala(antigua, 0.5), 'calibracion_antigua')
    assert.equal(estadoEscala(antigua, 1.4), 'calibracion_antigua')
    // En un plano cuadrado la calibración antigua era correcta.
    assert.equal(estadoEscala(antigua, 1), 'ok')
    assert.equal(estadoEscala(antigua, 1.01), 'ok')
    // Sin conocer la proporción todavía no se acusa.
    assert.equal(estadoEscala(antigua, null), 'ok')
    // Calibrada con la versión nueva.
    assert.equal(estadoEscala({ metersPerNormX: 40, metersPerNormY: 20, calibrated: true, aspect: 0.5 }, 0.5), 'ok')
    assert.equal(estadoEscala({ metersPerNormX: 40, metersPerNormY: 40, calibrated: false }, 0.5), 'sin_calibrar')
  })

  it('un plano sin calibrar toma el alto que corresponde a su proporción', () => {
    const sin = { metersPerNormX: 40, metersPerNormY: 40, calibrated: false }
    assert.deepEqual(ajustarEscalaSinCalibrar(sin, 0.5), {
      metersPerNormX: 40,
      metersPerNormY: 20,
      calibrated: false,
      aspect: 0.5,
    })
    // Ya ajustado: no hay nada que cambiar.
    assert.equal(ajustarEscalaSinCalibrar({ ...sin, metersPerNormY: 20, aspect: 0.5 }, 0.5), null)
    // Una calibración hecha por el usuario nunca se toca sola.
    assert.equal(ajustarEscalaSinCalibrar({ ...sin, calibrated: true }, 0.5), null)
    assert.equal(ajustarEscalaSinCalibrar(sin, null), null)
  })
})
