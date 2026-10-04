import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  VISION_SEMAFORO_HEX,
  VISION_SEMAFORO_LEGEND,
  VISION_SEMAFORO_RGB,
  visionBandSolidFill,
} from './visionSemaforoPalette'

describe('visionSemaforoPalette', () => {
  it('usa neón saturado (no Tailwind apagado) en verde, naranja y rojo', () => {
    const [gr, gg, gb] = VISION_SEMAFORO_RGB.green
    const [yr, yg, yb] = VISION_SEMAFORO_RGB.yellow
    const [rr, rg, rb] = VISION_SEMAFORO_RGB.red
    assert.ok(gg >= 240 && gr <= 40, 'verde neón')
    assert.ok(yr >= 240 && yg >= 100 && yg <= 170 && yb <= 40, 'naranja, no amarillo')
    assert.ok(rr >= 240 && rg <= 50 && rb <= 50, 'rojo vivo')
  })

  it('el relleno usa la opacidad de la capa (sin alpha extra)', () => {
    assert.equal(visionBandSolidFill('green', 0.36), 'rgba(0, 255, 65, 0.36)')
    assert.equal(visionBandSolidFill('yellow', 0.36), 'rgba(255, 140, 0, 0.36)')
    assert.equal(visionBandSolidFill('red', 0.36), 'rgba(255, 32, 32, 0.36)')
  })

  it('la leyenda dice Naranja (no Amarillo) y comparte el hex del relleno', () => {
    assert.deepEqual(
      VISION_SEMAFORO_LEGEND.map((x) => x.label),
      ['Verde', 'Naranja', 'Rojo'],
    )
    assert.equal(VISION_SEMAFORO_LEGEND[1]!.hex, VISION_SEMAFORO_HEX.yellow)
  })
})
