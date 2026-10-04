import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  NIGHT_BG,
  NIGHT_DETAIL_MIN,
  NIGHT_NEON,
  NIGHT_WALL,
  applyNightPlanoPalette,
  clampGrosorMuro,
  liftWhitePlanOverVision,
  neonIndexForColor,
  normalizeCotaColor,
  wallDilateFromGrosor,
} from './nightPlanoPalette'

function blank(w: number, h: number, rgb: readonly [number, number, number] = [255, 255, 255]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0]
    data[i + 1] = rgb[1]
    data[i + 2] = rgb[2]
    data[i + 3] = 255
  }
  return data
}

function paint(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: readonly [number, number, number] = [0, 0, 0],
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = (y * w + x) * 4
      data[p] = rgb[0]
      data[p + 1] = rgb[1]
      data[p + 2] = rgb[2]
    }
  }
}

function rgbAt(data: Uint8ClampedArray, w: number, x: number, y: number) {
  const p = (y * w + x) * 4
  return [data[p], data[p + 1], data[p + 2]] as const
}

function isNeon(rgb: readonly number[]): boolean {
  return NIGHT_NEON.some((n) => n[0] === rgb[0] && n[1] === rgb[1] && n[2] === rgb[2])
}

describe('applyNightPlanoPalette', () => {
  it('papel a negro y muro grueso a blanco', () => {
    const w = 200
    const h = 160
    const data = blank(w, h)
    paint(data, w, 10, 70, 189, 82)
    applyNightPlanoPalette(data, w, h)
    assert.deepEqual([...rgbAt(data, w, 4, 4)], [...NIGHT_BG])
    assert.deepEqual([...rgbAt(data, w, 100, 76)], [...NIGHT_WALL])
    assert.deepEqual([...rgbAt(data, w, 10, 70)], [...NIGHT_WALL])
  })

  it('número compacto y cota fina cercana salen en neón', () => {
    const w = 400
    const h = 320
    const data = blank(w, h)
    // “4” a trazo fino (como glifo CAD), no un bloque macizo.
    paint(data, w, 80, 70, 81, 86)
    paint(data, w, 74, 78, 88, 79)
    paint(data, w, 70, 88, 130, 88)
    applyNightPlanoPalette(data, w, h)
    const digit = rgbAt(data, w, 80, 76)
    const tick = rgbAt(data, w, 120, 88)
    assert.equal(isNeon(digit), true, `dígito ${digit.join(',')}`)
    assert.equal(isNeon(tick), true, `cota ${tick.join(',')}`)
    assert.deepEqual([...digit], [...tick])
  })

  it('cota horizontal y vertical pueden usar neones distintos', () => {
    const w = 400
    const h = 320
    const data = blank(w, h)
    paint(data, w, 40, 40, 41, 52)
    paint(data, w, 36, 46, 50, 47)
    paint(data, w, 30, 54, 140, 54)
    paint(data, w, 280, 50, 281, 62)
    paint(data, w, 276, 56, 290, 57)
    paint(data, w, 312, 40, 312, 120)
    applyNightPlanoPalette(data, w, h)
    const a = rgbAt(data, w, 40, 45)
    const b = rgbAt(data, w, 80, 54)
    const c = rgbAt(data, w, 280, 55)
    const d = rgbAt(data, w, 312, 80)
    assert.equal(isNeon(a), true, `h ${a.join(',')}`)
    assert.equal(isNeon(b), true, `hl ${b.join(',')}`)
    assert.equal(isNeon(c), true, `v ${c.join(',')}`)
    assert.equal(isNeon(d), true, `vl ${d.join(',')}`)
  })

  it('cotaColor azul pinta dígito y cota en azul eléctrico', () => {
    const w = 400
    const h = 320
    const data = blank(w, h)
    paint(data, w, 80, 70, 81, 86)
    paint(data, w, 74, 78, 88, 79)
    paint(data, w, 70, 88, 130, 88)
    applyNightPlanoPalette(data, w, h, { cotaColor: 'azul' })
    const digit = rgbAt(data, w, 80, 76)
    const tick = rgbAt(data, w, 120, 88)
    assert.deepEqual([...digit], [...NIGHT_NEON[2]!])
    assert.deepEqual([...tick], [...NIGHT_NEON[2]!])
  })

  it('cotaColor blanco pinta dígito y cota en blanco', () => {
    const w = 400
    const h = 320
    const data = blank(w, h)
    paint(data, w, 80, 70, 81, 86)
    paint(data, w, 74, 78, 88, 79)
    paint(data, w, 70, 88, 130, 88)
    applyNightPlanoPalette(data, w, h, { cotaColor: 'blanco' })
    const digit = rgbAt(data, w, 80, 76)
    const tick = rgbAt(data, w, 120, 88)
    assert.deepEqual([...digit], [...NIGHT_WALL])
    assert.deepEqual([...tick], [...NIGHT_WALL])
  })

  it('cotaColor naranja pinta dígito y cota del mismo neón', () => {
    const w = 400
    const h = 320
    const data = blank(w, h)
    paint(data, w, 80, 70, 81, 86)
    paint(data, w, 74, 78, 88, 79)
    paint(data, w, 70, 88, 130, 88)
    applyNightPlanoPalette(data, w, h, { cotaColor: 'naranja' })
    const digit = rgbAt(data, w, 80, 76)
    const tick = rgbAt(data, w, 120, 88)
    assert.deepEqual([...digit], [...NIGHT_NEON[1]!])
    assert.deepEqual([...tick], [...NIGHT_NEON[1]!])
  })

  it('grosor alto traga una raya fina pegada al muro; grosor 0 la deja en neón', () => {
    const w = 200
    const h = 160
    const thin = blank(w, h)
    const fat = blank(w, h)
    paint(thin, w, 10, 70, 189, 82)
    paint(thin, w, 80, 84, 120, 84)
    paint(fat, w, 10, 70, 189, 82)
    paint(fat, w, 80, 84, 120, 84)
    applyNightPlanoPalette(thin, w, h, { grosorMuro: 0 })
    applyNightPlanoPalette(fat, w, h, { grosorMuro: 100 })
    const nearThin = rgbAt(thin, w, 100, 84)
    const nearFat = rgbAt(fat, w, 100, 84)
    assert.deepEqual([...rgbAt(thin, w, 100, 76)], [...NIGHT_WALL])
    assert.deepEqual([...rgbAt(fat, w, 100, 76)], [...NIGHT_WALL])
    assert.equal(isNeon(nearThin), true, `raya fina ${nearThin.join(',')}`)
    assert.deepEqual([...nearFat], [...NIGHT_WALL])
  })

  it('foto con medios tonos se invierte y se levanta para verse en negro', () => {
    const w = 20
    const h = 20
    const data = blank(w, h, [128, 128, 128])
    applyNightPlanoPalette(data, w, h)
    const rgb = rgbAt(data, w, 2, 2)
    const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    assert.ok(y >= NIGHT_DETAIL_MIN - 1, `detalle ${rgb.join(',')} luma ${y}`)
  })

  it('gris de mueble/auto no se pierde en el fondo negro', () => {
    const w = 200
    const h = 160
    const data = blank(w, h)
    paint(data, w, 40, 40, 90, 70, [176, 176, 176])
    applyNightPlanoPalette(data, w, h)
    assert.deepEqual([...rgbAt(data, w, 4, 4)], [...NIGHT_BG])
    const detail = rgbAt(data, w, 60, 55)
    const y = 0.2126 * detail[0] + 0.7152 * detail[1] + 0.0722 * detail[2]
    assert.ok(y >= NIGHT_DETAIL_MIN - 1, `mueble ${detail.join(',')} luma ${y}`)
    assert.ok(detail[0] > 40, 'no debe quedar casi negro')
  })
})

describe('night plano helpers', () => {
  it('normaliza color de cota y grosor', () => {
    assert.equal(normalizeCotaColor('NARANJA'), 'naranja')
    assert.equal(normalizeCotaColor('x'), 'auto')
    assert.equal(clampGrosorMuro(-4), 0)
    assert.equal(clampGrosorMuro(140), 100)
    assert.equal(clampGrosorMuro('no'), 50)
    assert.equal(wallDilateFromGrosor(0), 0)
    assert.equal(wallDilateFromGrosor(50), 2)
    assert.equal(wallDilateFromGrosor(100), 4)
    assert.equal(neonIndexForColor('verde'), 0)
    assert.equal(neonIndexForColor('naranja'), 1)
    assert.equal(normalizeCotaColor('amarillo'), 'azul')
    assert.equal(neonIndexForColor('azul'), 2)
    assert.equal(neonIndexForColor('blanco'), -1)
    assert.equal(normalizeCotaColor('blanco'), 'blanco')
    assert.equal(neonIndexForColor('auto'), null)
    assert.equal(liftWhitePlanOverVision(true, 'blanco'), true)
    assert.equal(liftWhitePlanOverVision(true, 'azul'), false)
    assert.equal(liftWhitePlanOverVision(false, 'blanco'), false)
  })
})
