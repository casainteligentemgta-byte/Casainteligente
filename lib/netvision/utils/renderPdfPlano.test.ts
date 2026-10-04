import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PDF_PLANO_MAX_LONG_EDGE,
  PDF_PLANO_MIN_SCALE,
  PDF_PLANO_TARGET_LONG_EDGE,
  pdfPlanoRenderScale,
  shouldSmoothPlanoImage,
} from './renderPdfPlano'

describe('pdfPlanoRenderScale', () => {
  it('A4 portrait (~842 pt) apunta al lado largo de 3200 px', () => {
    const scale = pdfPlanoRenderScale(595, 842)
    assert.ok(Math.abs(scale * 842 - PDF_PLANO_TARGET_LONG_EDGE) < 1)
    assert.ok(scale > 3.5)
    assert.ok(scale > 1.5)
  })

  it('carta US (~792 pt) también supera el viejo 1.5×', () => {
    const scale = pdfPlanoRenderScale(612, 792)
    assert.ok(scale * 792 >= PDF_PLANO_TARGET_LONG_EDGE - 1)
    assert.ok(scale > 2)
  })

  it('hoja grande (36") no pasa de 4096 px', () => {
    const w = 36 * 72
    const h = 24 * 72
    const scale = pdfPlanoRenderScale(w, h)
    assert.ok(scale * w <= PDF_PLANO_MAX_LONG_EDGE + 1e-6)
    assert.ok(Math.abs(scale * w - PDF_PLANO_MAX_LONG_EDGE) < 1)
  })

  it('página minúscula no pide más que el tope', () => {
    const scale = pdfPlanoRenderScale(40, 30)
    assert.ok(scale * 40 <= PDF_PLANO_MAX_LONG_EDGE + 1e-6)
    assert.ok(scale * 40 >= PDF_PLANO_TARGET_LONG_EDGE - 1)
  })

  it('valores inválidos caen al mínimo', () => {
    assert.equal(pdfPlanoRenderScale(0, 0), PDF_PLANO_MIN_SCALE)
    assert.equal(pdfPlanoRenderScale(Number.NaN, 100), PDF_PLANO_MIN_SCALE)
  })
})

describe('shouldSmoothPlanoImage', () => {
  it('suaviza al encajar un bitmap grande en el viewport', () => {
    assert.equal(shouldSmoothPlanoImage(3200, 1100, 1), true)
  })

  it('no suaviza al hacer zoom para leer acotamiento', () => {
    assert.equal(shouldSmoothPlanoImage(3200, 1100, 3.2), false)
  })

  it('no suaviza cuando el dibujo ya está a 1:1 o más', () => {
    assert.equal(shouldSmoothPlanoImage(2000, 2000, 1), false)
    assert.equal(shouldSmoothPlanoImage(2000, 2000, 1.5), false)
  })

  it('suaviza si faltan medidas', () => {
    assert.equal(shouldSmoothPlanoImage(0, 100, 1), true)
    assert.equal(shouldSmoothPlanoImage(100, 0, 1), true)
  })
})
