import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  acotarDesplazamiento,
  acotarZoom,
  detectarFondoCaptura,
  expandirRecorte,
  limiteDesplazamiento,
  limitesContenidoCaptura,
  recorteGanaEspacio,
} from './planoRecorte'

/** Lienzo oscuro con un «plano» claro en el rectángulo indicado. */
function lienzo(
  width: number,
  height: number,
  plano: { x: number; y: number; w: number; h: number } | null,
  fondo: [number, number, number] = [5, 8, 13],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dentro =
        plano && x >= plano.x && x < plano.x + plano.w && y >= plano.y && y < plano.y + plano.h
      const i = (y * width + x) * 4
      // Ruido leve, como el de un JPEG.
      const ruido = (x * 7 + y * 13) % 5
      data[i] = (dentro ? 232 : fondo[0]) + ruido
      data[i + 1] = (dentro ? 230 : fondo[1]) + ruido
      data[i + 2] = (dentro ? 224 : fondo[2]) + ruido
      data[i + 3] = 255
    }
  }
  return data
}

describe('planoRecorte', () => {
  it('encuentra el plano dentro del margen oscuro del editor', () => {
    const data = lienzo(200, 100, { x: 70, y: 20, w: 80, h: 50 })
    const b = limitesContenidoCaptura(data, 200, 100)
    assert.deepEqual(b, { x: 70, y: 20, w: 80, h: 50 })
    assert.equal(recorteGanaEspacio(b!, 200, 100), true)
  })

  it('incluye lo que queda fuera del papel (etiquetas, cables)', () => {
    const data = lienzo(200, 100, { x: 70, y: 20, w: 80, h: 50 })
    // Una etiqueta clara a la izquierda del plano.
    for (let y = 60; y < 68; y++) {
      for (let x = 30; x < 50; x++) {
        const i = (y * 200 + x) * 4
        data[i] = 60
        data[i + 1] = 200
        data[i + 2] = 230
      }
    }
    const b = limitesContenidoCaptura(data, 200, 100)
    assert.deepEqual(b, { x: 30, y: 20, w: 120, h: 50 })
  })

  it('no recorta si el plano ya llena el lienzo', () => {
    const lleno = lienzo(120, 80, { x: 0, y: 0, w: 120, h: 80 })
    // Todas las esquinas son «papel»: el fondo detectado es el papel y no queda contenido.
    assert.equal(limitesContenidoCaptura(lleno, 120, 80), null)
    const casi = lienzo(120, 80, { x: 2, y: 2, w: 116, h: 76 })
    const b = limitesContenidoCaptura(casi, 120, 80)
    assert.ok(b)
    assert.equal(recorteGanaEspacio(b, 120, 80), false)
  })

  it('sin margen uniforme no hay fondo que quitar', () => {
    const data = lienzo(40, 40, null)
    // Dos esquinas claras, dos oscuras.
    for (const [x, y] of [
      [2, 2],
      [37, 2],
    ] as const) {
      const i = (y * 40 + x) * 4
      data[i] = 240
      data[i + 1] = 240
      data[i + 2] = 240
    }
    assert.equal(detectarFondoCaptura(data, 40, 40), null)
  })

  it('el margen del recorte no se sale de la imagen', () => {
    assert.deepEqual(expandirRecorte({ x: 70, y: 20, w: 80, h: 50 }, 200, 100, 0.05), {
      x: 66,
      y: 16,
      w: 88,
      h: 58,
    })
    assert.deepEqual(expandirRecorte({ x: 1, y: 1, w: 198, h: 98 }, 200, 100, 0.05), {
      x: 0,
      y: 0,
      w: 200,
      h: 100,
    })
  })

  it('acota el zoom y el desplazamiento', () => {
    assert.equal(acotarZoom(0.3), 1)
    assert.equal(acotarZoom(1.6), 1.5)
    assert.equal(acotarZoom(9), 4)
    assert.equal(limiteDesplazamiento(1), 0)
    assert.equal(limiteDesplazamiento(2), 0.5)
    assert.deepEqual(acotarDesplazamiento({ x: 0.9, y: -0.9 }, 2), { x: 0.5, y: -0.5 })
    assert.deepEqual(acotarDesplazamiento({ x: 0.3, y: 0.1 }, 1), { x: 0, y: 0 })
  })
})
