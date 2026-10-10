import { describe, it } from 'bun:test'
import assert from 'node:assert/strict'
import {
  clampIntensidad,
  factorCobertura,
  intensificarTrazosPlano,
  opacidadCobertura,
} from '@/lib/netvision/utils/intensidadPlano'

function lienzo(w: number, h: number, fondo: number) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = fondo
    d[i * 4 + 1] = fondo
    d[i * 4 + 2] = fondo
    d[i * 4 + 3] = 255
  }
  return d
}
const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4]!

describe('intensidad de cobertura', () => {
  it('por defecto es la opacidad de siempre', () => {
    assert.equal(opacidadCobertura(undefined), 0.36)
    assert.equal(factorCobertura(undefined), 1)
  })
  it('se acota entre 5 % y 95 %', () => {
    assert.equal(opacidadCobertura(0), 0.05)
    assert.equal(opacidadCobertura(100), 0.95)
    assert.equal(clampIntensidad('abc', 7), 7)
  })
})

describe('intensificarTrazosPlano', () => {
  it('con 0 no toca la imagen', () => {
    const d = lienzo(4, 4, 120)
    intensificarTrazosPlano(d, 4, 4, 0)
    assert.equal(px(d, 4, 1, 1), 120)
  })

  it('una foto gris: el papel queda blanco y la línea gris se oscurece y engruesa', () => {
    const w = 21
    const h = 21
    const d = lienzo(w, h, 200) // papel de foto (gris claro)
    for (let y = 0; y < h; y++) {
      const p = (y * w + 10) * 4
      d[p] = d[p + 1] = d[p + 2] = 120 // línea vertical gris
    }
    intensificarTrazosPlano(d, w, h, 100)
    assert.equal(px(d, w, 2, 2), 255)
    assert.ok(px(d, w, 10, 10) < 60, `línea ${px(d, w, 10, 10)}`)
    assert.ok(px(d, w, 12, 10) < 60, 'la línea se engruesa 2 px')
    assert.equal(px(d, w, 13, 10), 255)
  })

  it('a más intensidad, más oscuro el trazo', () => {
    const medir = (nivel: number) => {
      const d = lienzo(9, 9, 230)
      const p = (4 * 9 + 4) * 4
      d[p] = d[p + 1] = d[p + 2] = 150
      intensificarTrazosPlano(d, 9, 9, nivel)
      return px(d, 9, 4, 4)
    }
    assert.ok(medir(80) < medir(30))
  })
})
