/**
 * Ejecutar: npx tsx --test lib/netvision/catalog/cameras.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cameraCatalogOptionLabel,
  cameraVisionSummary,
  camerasByBrand,
  getCameraModel,
  isDualCameraModel,
} from './cameras'

describe('catálogo Aqara', () => {
  const aqara = camerasByBrand('Aqara')

  it('incluye la línea actual con facultades de visión', () => {
    const ids = aqara.map((m) => m.id)
    assert.deepEqual(
      ids.sort(),
      [
        'aqara-doorbell-g4',
        'aqara-doorbell-g400',
        'aqara-doorbell-g410',
        'aqara-e1',
        'aqara-g100',
        'aqara-g2h',
        'aqara-g2h-pro',
        'aqara-g3',
        'aqara-g350',
        'aqara-g5-pro-poe',
        'aqara-g5-pro-wifi',
      ].sort(),
    )
    assert.equal(getCameraModel('aqara-hub-m3-cam'), undefined)
    assert.equal(getCameraModel('aqara-outdoor-camera'), undefined)
  })

  it('G5 Pro usa FOV horizontal 112° y color night', () => {
    const poe = getCameraModel('aqara-g5-pro-poe')
    assert.ok(poe)
    assert.equal(poe.fovDeg, 112)
    assert.equal(poe.formFactor, 'bullet')
    assert.match(poe.notes ?? '', /color/i)
    assert.equal(poe.rangeNightM, 16)
  })

  it('G350 es dual 4K + tele con dos conos', () => {
    const g350 = getCameraModel('aqara-g350')
    assert.ok(g350)
    assert.equal(isDualCameraModel('aqara-g350'), true)
    assert.equal(g350.lenses?.length, 2)
    assert.equal(g350.lenses?.[0]?.fovDeg, 127)
    assert.equal(g350.lenses?.[1]?.fovDeg, 38)
    assert.equal(g350.formFactor, 'ptz')
    assert.match(cameraCatalogOptionLabel(g350), /Dual 127°\+38°/)
  })

  it('PTZ interiores G3 y E1 no fingen 360° de FOV', () => {
    const g3 = getCameraModel('aqara-g3')
    const e1 = getCameraModel('aqara-e1')
    assert.equal(g3?.formFactor, 'ptz')
    assert.equal(g3?.fovDeg, 110)
    assert.equal(e1?.formFactor, 'ptz')
    assert.equal(e1?.fovDeg, 93)
    assert.match(g3?.notes ?? '', /encuadre actual/)
  })

  it('el resumen lista resolución, FOV y alcances', () => {
    const g100 = getCameraModel('aqara-g100')
    assert.ok(g100)
    assert.equal(
      cameraVisionSummary(g100),
      '2K · bullet · 135° · día 16 m / noche 12 m',
    )
    assert.match(g100.notes ?? '', /IP65/)
  })
})
