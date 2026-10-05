/**
 * Ejecutar: npx tsx --test lib/netvision/catalog/cameras.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cameraCatalogOptionLabel,
  cameraPatchForLens,
  cameraVisionSummary,
  camerasByBrand,
  catalogVisionDefaults,
  effectiveCameraLenses,
  getCameraModel,
  isDualCameraModel,
  lenteDeFicha,
  lenteElegida,
  lenteNoEstandar,
  opcionesLente,
  parcheLente,
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

describe('Dual · conos autónomos', () => {
  const base = {
    id: 'c1',
    label: 'CAM-01',
    x: 0.5,
    y: 0.5,
    modelId: 'aqara-g350',
    yawDeg: 90,
    mountHeightM: 2.8,
    retentionDays: 30,
    complianceProfileId: 'x',
  }

  it('sin ajuste propio, la tele mira hacia donde mira la gran angular', () => {
    const [wide, tele] = effectiveCameraLenses(base)
    assert.equal(wide!.yawDeg, 90)
    assert.equal(tele!.yawDeg, 90)
  })

  it('girar la tele no mueve la gran angular, y viceversa', () => {
    const cam = { ...base, ...cameraPatchForLens(base, 'tele', { yawDeg: 270, rangeM: 20 }) }
    const [wide, tele] = effectiveCameraLenses(cam)
    assert.equal(wide!.yawDeg, 90)
    assert.equal(tele!.yawDeg, 270)
    assert.equal(tele!.rangeM, 20)
    const cam2 = { ...cam, ...cameraPatchForLens(cam, 'wide', { yawDeg: 0 }) }
    const [w2, t2] = effectiveCameraLenses(cam2)
    assert.equal(w2!.yawDeg, 0)
    assert.equal(t2!.yawDeg, 270)
  })

  it('la apertura de la tele es propia', () => {
    const cam = { ...base, ...cameraPatchForLens(base, 'tele', { fovLeftDeg: 10, fovRightDeg: 10 }) }
    const [wide, tele] = effectiveCameraLenses(cam)
    assert.equal(tele!.fovDeg, 20)
    assert.equal(wide!.fovDeg, 127)
  })

  it('cambiar de modelo o restaurar vuelve a alinear las lentes', () => {
    const d = catalogVisionDefaults('aqara-g350')
    assert.ok('lensVision' in d)
    assert.equal(d.lensVision, undefined)
  })
})

describe('lentes intercambiables', () => {
  const hik = getCameraModel('hik-ds2cd2143')!

  it('Hikvision DS-2CD2143G2-I: 2.8 mm (103°) de ficha y 4 mm (84°), con su DORI oficial', () => {
    assert.equal(hik.fovDeg, 103)
    assert.equal(hik.sensorWidthPx, 2688)
    assert.deepEqual(opcionesLente(hik), [
      { focalMm: 2.8, fovDeg: 103, doriDetectM: 67 },
      { focalMm: 4, fovDeg: 84, doriDetectM: 80 },
    ])
    assert.equal(lenteDeFicha(hik)?.focalMm, 2.8)
    const t47 = getCameraModel('hik-ds2cd2t47')!
    assert.deepEqual(
      opcionesLente(t47).map((o) => [o.focalMm, o.fovDeg, o.doriDetectM]),
      [
        [2.8, 112, 58],
        [4, 95, 77],
        [6, 58, 115],
      ],
    )
    assert.equal(lenteDeFicha(t47)?.focalMm, 4)
  })

  it('la lente de ficha de cada modelo coincide con su ángulo de catálogo', () => {
    let conOpciones = 0
    for (const id of ['hik-ds2cd2143', 'hik-ds2cd2t47', 'ezviz-h3', 'ezviz-h4', 'ezviz-h4-poe', 'ezviz-h8c', 'ezviz-c3w-pro']) {
      const m = getCameraModel(id)!
      const ficha = lenteDeFicha(m)
      assert.ok(ficha, id)
      assert.equal(ficha!.fovDeg, m.fovDeg, id)
      assert.equal(ficha!.focalMm, m.focalMm, id)
      conOpciones++
    }
    assert.equal(conOpciones, 7)
    // Un modelo de una sola lente no ofrece opciones.
    assert.deepEqual(opcionesLente(getCameraModel('ezviz-c6n')!), [])
    assert.equal(lenteElegida(getCameraModel('ezviz-c6n')!, {}), null)
  })

  it('elegir lente cambia el cono al ángulo real de esa lente', () => {
    const parche = parcheLente('hik-ds2cd2143', 4)
    assert.deepEqual(parche, { lensFocalMm: 4, fovDeg: 84, fovLeftDeg: 42, fovRightDeg: 42 })
    const cam = { id: 'c', label: 'CAM', x: 0.5, y: 0.5, modelId: 'hik-ds2cd2143', yawDeg: 0, mountHeightM: 3, ...parche }
    assert.equal(effectiveCameraLenses(cam)[0]!.fovDeg, 84)
    assert.equal(lenteElegida(hik, cam)?.focalMm, 4)
    assert.equal(lenteNoEstandar(cam), 4)
    // La de ficha no es «no estándar»; una que no existe tampoco.
    assert.equal(lenteNoEstandar({ modelId: 'hik-ds2cd2143' }), null)
    assert.equal(lenteNoEstandar({ modelId: 'hik-ds2cd2143', lensFocalMm: 2.8 }), null)
    assert.equal(lenteNoEstandar({ modelId: 'hik-ds2cd2143', lensFocalMm: 12 }), null)
    assert.deepEqual(parcheLente('hik-ds2cd2143', 12), {})
  })

  it('sin recorte manual, el cono sigue a la lente elegida', () => {
    const base = { id: 'c', label: 'CAM', x: 0.5, y: 0.5, modelId: 'ezviz-h4', yawDeg: 0, mountHeightM: 3 }
    assert.equal(effectiveCameraLenses(base)[0]!.fovDeg, 106)
    assert.equal(effectiveCameraLenses({ ...base, lensFocalMm: 6 })[0]!.fovDeg, 52)
  })

  it('cambiar de modelo vuelve a la lente de ficha; restaurar conserva la elegida', () => {
    assert.equal(catalogVisionDefaults('hik-ds2cd2143').lensFocalMm, undefined)
    assert.equal(catalogVisionDefaults('hik-ds2cd2143').fovDeg, 103)
    const restaurar = catalogVisionDefaults('hik-ds2cd2143', 'day', 4)
    assert.equal(restaurar.lensFocalMm, 4)
    assert.equal(restaurar.fovDeg, 84)
    // Pedir la de ficha no deja el campo puesto.
    assert.equal(catalogVisionDefaults('hik-ds2cd2143', 'day', 2.8).lensFocalMm, undefined)
  })
})
