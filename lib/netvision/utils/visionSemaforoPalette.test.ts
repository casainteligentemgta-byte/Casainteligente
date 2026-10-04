import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  VISION_SEMAFORO_FILL_ALPHA,
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

  it('el relleno es casi opaco para que la capa sola controle la transparencia', () => {
    for (const band of ['green', 'yellow', 'red'] as const) {
      assert.ok(VISION_SEMAFORO_FILL_ALPHA[band] >= 0.85)
      assert.match(visionBandSolidFill(band), /^rgba\(\d+, \d+, \d+, 0\.\d+\)$/)
    }
  })

  it('la leyenda dice Naranja (no Amarillo) y comparte el hex del relleno', () => {
    assert.deepEqual(
      VISION_SEMAFORO_LEGEND.map((x) => x.label),
      ['Verde', 'Naranja', 'Rojo'],
    )
    assert.equal(VISION_SEMAFORO_LEGEND[1]!.hex, VISION_SEMAFORO_HEX.yellow)
  })
})
