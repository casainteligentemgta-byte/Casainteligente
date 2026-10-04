import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAM_MARKER_HEX,
  DEFAULT_CAM_MARKER_COLOR,
  camMarkerHex,
  camMarkerRing,
  nextCamMarkerColor,
  normalizeCamMarkerColor,
} from './cameraMarkerColor'

describe('cameraMarkerColor', () => {
  it('normaliza alias y cae a cian', () => {
    assert.equal(normalizeCamMarkerColor('CYAN'), 'cian')
    assert.equal(normalizeCamMarkerColor('verde'), 'verde')
    assert.equal(normalizeCamMarkerColor('amarillo'), 'naranja')
    assert.equal(normalizeCamMarkerColor('x'), DEFAULT_CAM_MARKER_COLOR)
    assert.equal(normalizeCamMarkerColor(undefined), DEFAULT_CAM_MARKER_COLOR)
  })

  it('hex y aro contrastan', () => {
    assert.equal(camMarkerHex('azul'), CAM_MARKER_HEX.azul)
    assert.equal(camMarkerRing(CAM_MARKER_HEX.blanco), '#0f172a')
    assert.equal(camMarkerRing(CAM_MARKER_HEX.cian), '#ffffff')
  })

  it('reparte colores al agregar cámaras', () => {
    assert.equal(nextCamMarkerColor(0), 'cian')
    assert.equal(nextCamMarkerColor(1), 'verde')
    assert.equal(nextCamMarkerColor(6), 'cian')
  })
})
