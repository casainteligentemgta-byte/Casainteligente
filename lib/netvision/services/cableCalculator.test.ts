import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CableRoute } from '@/lib/netvision/types'
import {
  buildCableBomLines,
  cableMaxM,
  cableWarning,
  exceedsNetworkCopperLimit,
  intermediateSwitchesNeeded,
  overLimitSwitchMessage,
  recommendCableType,
} from './cableCalculator'
import {
  MANUAL_CABLE_TO_ID,
  buildCableRoutes,
  cableSegmentToRoute,
  planNetworkUplinks,
  routeMidpoint,
  validateCableRoutes,
} from './cableRoutingEngine'

describe('cable de red de más de 100 m', () => {
  it('no se convierte en fibra', () => {
    for (const m of [101, 126, 240, 900]) {
      assert.notEqual(recommendCableType(m), 'FIBER', `${m} m`)
      assert.equal(recommendCableType(m), 'CAT6')
    }
    assert.equal(recommendCableType(20), 'CAT6')
    assert.equal(recommendCableType(40), 'CAT6A')
    assert.equal(recommendCableType(80), 'CAT6')
  })

  it('avisa que necesita un switch intermedio', () => {
    assert.equal(
      cableWarning(126, 'CAT6'),
      'Tramo de 126 m: supera los 100 m, necesita un switch intermedio',
    )
    assert.equal(
      cableWarning(240.4, 'CAT5E'),
      'Tramo de 240.4 m: supera los 100 m, necesita 2 switches intermedios',
    )
    assert.match(cableWarning(126)!, /necesita un switch intermedio/)
    assert.doesNotMatch(cableWarning(126, 'CAT6')!, /fibra/i)
  })

  it('cuenta los switches necesarios', () => {
    assert.equal(intermediateSwitchesNeeded(100), 0)
    assert.equal(intermediateSwitchesNeeded(100.1), 1)
    assert.equal(intermediateSwitchesNeeded(200), 1)
    assert.equal(intermediateSwitchesNeeded(200.1), 2)
    assert.equal(intermediateSwitchesNeeded(350), 3)
    assert.match(overLimitSwitchMessage(350), /necesita 3 switches intermedios/)
  })

  it('el límite aplica al cable de red, no a la fibra dibujada a mano', () => {
    assert.equal(exceedsNetworkCopperLimit(126, 'CAT6'), true)
    assert.equal(exceedsNetworkCopperLimit(126, 'CAT6A'), true)
    assert.equal(exceedsNetworkCopperLimit(100, 'CAT6'), false)
    assert.equal(exceedsNetworkCopperLimit(126, 'FIBER'), false)
    assert.equal(exceedsNetworkCopperLimit(126, 'POWER_12V'), false)
    assert.equal(cableWarning(500, 'FIBER'), null)
  })

  it('Cat 6A también llega a 100 m', () => {
    assert.equal(cableMaxM('CAT6A'), 100)
    assert.equal(cableWarning(70, 'CAT6A'), null)
    assert.match(cableWarning(95, 'CAT6A')!, /Cerca del límite de 100 m/)
  })

  it('los otros cables conservan su propio aviso', () => {
    assert.match(cableWarning(40, 'POWER_12V')!, /12V/)
    assert.match(cableWarning(60, 'AUDIO')!, /sonido/)
    assert.equal(cableWarning(50, 'CAT6'), null)
  })
})

describe('rutas de cable · tramo largo', () => {
  // Plano de 200 m × 200 m: cámara y switch a 120 m en línea recta.
  const scale = { metersPerNormX: 200, metersPerNormY: 200, calibrated: true }
  const camaras = [
    { id: 'cam-1', label: 'CAM-01', x: 0.1, y: 0.5, modelId: 'ezviz-h4-poe', yawDeg: 0, mountHeightM: 3 },
    { id: 'cam-2', label: 'CAM-02', x: 0.6, y: 0.5, modelId: 'ezviz-h4-poe', yawDeg: 0, mountHeightM: 3 },
  ]
  const nodos = [
    { id: 'sw-1', label: 'SW-01', x: 0.7, y: 0.5, kind: 'switch' as const, modelId: 'sw-poe-8', linkedCameraIds: [] },
  ]
  const rutas = buildCableRoutes(camaras, nodos, scale)
  const larga = rutas.find((r) => r.fromId === 'cam-1')!
  const corta = rutas.find((r) => r.fromId === 'cam-2')!

  it('la ruta automática larga sigue siendo cable de red y queda marcada', () => {
    assert.ok(larga.routeM > 100, `mide ${larga.routeM} m`)
    assert.equal(larga.type, 'CAT6')
    assert.equal(larga.overLimit, true)
    assert.equal(larga.warn, true)
    assert.match(larga.warning!, /supera los 100 m, necesita un switch intermedio/)
    assert.equal(corta.overLimit, false)
    assert.equal(corta.warn, false)
  })

  it('la validación pide un switch intermedio, no fibra', () => {
    const errores = validateCableRoutes(rutas).filter((v) => v.code === 'CAB-001')
    assert.equal(errores.length, 1)
    assert.equal(errores[0]!.level, 'ERROR')
    assert.match(errores[0]!.message, /CAM-01→SW-01: Tramo de .* m: supera los 100 m/)
    assert.match(errores[0]!.solution, /switch intermedio/)
    assert.doesNotMatch(`${errores[0]!.message} ${errores[0]!.solution}`, /fibra/i)
  })

  it('la lista de materiales ya no suma fibra por su cuenta', () => {
    const lineas = buildCableBomLines(rutas)
    assert.ok(!lineas.some((l) => l.sku === 'CABLE-FIBER' || l.sku === 'FIBER-TERM'))
    const cat6 = lineas.find((l) => l.sku === 'CABLE-CAT6')!
    assert.ok(Math.abs(cat6.qty - (larga.routeM + corta.routeM)) < 0.11)
  })

  it('la fibra dibujada a mano se respeta', () => {
    const fibra = cableSegmentToRoute(
      { id: 'f1', label: 'Fibra patio', type: 'FIBER', x1: 0, y1: 0.5, x2: 1, y2: 0.5, points: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }] },
      scale,
    )
    assert.equal(fibra.type, 'FIBER')
    assert.equal(fibra.routeM, 200)
    assert.equal(fibra.overLimit, false)
    assert.equal(fibra.warn, false)
    assert.equal(fibra.toId, MANUAL_CABLE_TO_ID)
    const lineas = buildCableBomLines([fibra])
    assert.ok(lineas.some((l) => l.sku === 'CABLE-FIBER'))
  })

  it('un cable de red dibujado de más de 100 m también avisa', () => {
    const r: CableRoute = cableSegmentToRoute(
      { id: 'c1', label: 'Tramo patio', type: 'CAT6', x1: 0, y1: 0.2, x2: 0.75, y2: 0.2, points: [{ x: 0, y: 0.2 }, { x: 0.75, y: 0.2 }] },
      scale,
    )
    assert.equal(r.routeM, 150)
    assert.equal(r.overLimit, true)
    assert.match(r.warning!, /Tramo de 150 m: supera los 100 m, necesita un switch intermedio/)
  })
})

describe('punto medio del recorrido', () => {
  it('cae a la mitad del camino, no del primer tramo', () => {
    assert.deepEqual(routeMidpoint([{ x: 0, y: 0 }, { x: 1, y: 0 }]), { x: 0.5, y: 0 })
    // Recorrido en L de 0.2 + 0.6: la mitad (0.4) cae en el segundo tramo.
    const m = routeMidpoint([{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 0.6 }])!
    assert.ok(Math.abs(m.x - 0.2) < 1e-9)
    assert.ok(Math.abs(m.y - 0.2) < 1e-9)
    assert.equal(routeMidpoint([]), null)
    assert.deepEqual(routeMidpoint([{ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 }]), { x: 0.3, y: 0.3 })
  })
})

describe('cable entre equipos de red (switch → grabador)', () => {
  // Plano de 200 m × 100 m. Cámara a 150 m del grabador.
  const scale = { metersPerNormX: 200, metersPerNormY: 100, calibrated: true, aspect: 0.5 }
  const camara = { id: 'cam-1', label: 'CAM-01', x: 0.1, y: 0.5, modelId: 'ezviz-h4-poe', yawDeg: 0, mountHeightM: 3 }
  const nvr = { id: 'nvr-1', label: 'NVR-01', x: 0.85, y: 0.5, kind: 'nvr' as const, modelId: 'nvr-ds7608', linkedCameraIds: [] }
  const sw = { id: 'sw-1', label: 'SW-01', x: 0.45, y: 0.5, kind: 'switch' as const, modelId: 'sw-poe-8', linkedCameraIds: [] }

  it('sin switch el tramo avisa; con el switch quedan dos tramos válidos', () => {
    const solo = buildCableRoutes([camara], [nvr], scale)
    assert.equal(solo.length, 1)
    assert.equal(solo[0]!.overLimit, true)

    const rutas = buildCableRoutes([camara], [nvr, sw], scale)
    const camSw = rutas.find((r) => r.fromId === 'cam-1')!
    const swNvr = rutas.find((r) => r.fromId === 'sw-1')!
    assert.equal(camSw.toId, 'sw-1')
    assert.equal(swNvr.toId, 'nvr-1')
    assert.equal(swNvr.uplink, true)
    assert.ok(!camSw.uplink)
    // 70 m y 80 m en el plano, más la holgura.
    assert.ok(Math.abs(camSw.routeM - 80.5) < 0.11, `cámara→switch ${camSw.routeM}`)
    assert.ok(Math.abs(swNvr.routeM - 92) < 0.11, `switch→grabador ${swNvr.routeM}`)
    assert.equal(camSw.overLimit, false)
    assert.equal(swNvr.overLimit, false)
    // Se dibuja: tiene recorrido con extremos en los dos equipos.
    assert.deepEqual(swNvr.points[0], { x: 0.45, y: 0.5 })
    assert.deepEqual(swNvr.points[swNvr.points.length - 1], { x: 0.85, y: 0.5 })
  })

  it('el cable del switch al grabador se cobra', () => {
    const rutas = buildCableRoutes([camara], [nvr, sw], scale)
    const cat6 = buildCableBomLines(rutas).find((l) => l.sku === 'CABLE-CAT6')!
    assert.ok(Math.abs(cat6.qty - (80.5 + 92)) < 0.21, `cobra ${cat6.qty} m`)
    const sinEnlace = buildCableBomLines(rutas.filter((r) => !r.uplink)).find((l) => l.sku === 'CABLE-CAT6')!
    assert.ok(cat6.qty > sinEnlace.qty + 90)
  })

  it('un enlace entre equipos de más de 100 m también avisa', () => {
    const lejos = { ...sw, x: 0.2 }
    const rutas = buildCableRoutes([], [nvr, lejos], scale)
    assert.equal(rutas.length, 1)
    assert.equal(rutas[0]!.uplink, true)
    assert.equal(rutas[0]!.overLimit, true)
    assert.match(rutas[0]!.warning!, /necesita un switch intermedio/)
    assert.match(rutas[0]!.warning!, /incluye 15 % de holgura/)
  })

  it('arma el árbol más corto y no repite enlaces', () => {
    const sw2 = { ...sw, id: 'sw-2', label: 'SW-02', x: 0.2 }
    const inj = { ...sw, id: 'inj-1', label: 'INJ-01', x: 0.22, y: 0.4, kind: 'injector' as const, modelId: 'inj-poe-gig' }
    const enlaces = planNetworkUplinks([sw2, sw, nvr, inj], scale)
    assert.deepEqual(enlaces, [
      { fromId: 'sw-1', toId: 'nvr-1' },
      { fromId: 'sw-2', toId: 'sw-1' },
      { fromId: 'inj-1', toId: 'sw-2' },
    ])
    // Un solo equipo de red no necesita enlace; sin grabador la raíz es el primer switch.
    assert.deepEqual(planNetworkUplinks([sw], scale), [])
    assert.deepEqual(planNetworkUplinks([sw, sw2], scale), [{ fromId: 'sw-2', toId: 'sw-1' }])
    const ids = buildCableRoutes([], [sw2, sw, nvr, inj], scale).map((r) => r.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})
