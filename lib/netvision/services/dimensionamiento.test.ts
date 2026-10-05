import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DesignCamera, DesignInfraDevice, DesignNetworkNode } from '@/lib/netvision/types'
import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { estimateStorageTb } from '@/lib/netvision/services/bandwidthCalculator'
import {
  DIAS_GRABACION_DEFECTO,
  acotarDiasGrabacion,
  acotarRespaldoMin,
  alcanceUtilCamara,
  canalesRecomendados,
  dimensionarGrabacion,
  dimensionarUps,
  discosRecomendados,
  distanciaParaDensidad,
  pixelesHorizontales,
  resumenAlcanceUtil,
  upsRecomendadoVa,
} from './dimensionamiento'

const cam = (i: number, modelId = 'ezviz-h3'): DesignCamera => ({
  id: `cam-${i}`,
  label: `CAM-${String(i).padStart(2, '0')}`,
  x: 0.5,
  y: 0.5,
  modelId,
  yawDeg: 0,
  mountHeightM: 3,
})
const camaras = (n: number, modelId?: string) => Array.from({ length: n }, (_, i) => cam(i + 1, modelId))
const nodo = (id: string, kind: DesignNetworkNode['kind'], modelId: string): DesignNetworkNode => ({
  id,
  label: id.toUpperCase(),
  kind,
  modelId,
  x: 0.5,
  y: 0.5,
  linkedCameraIds: [],
})
const disco = (id: string, capacityTb: number): DesignInfraDevice => ({
  id,
  label: id.toUpperCase(),
  kind: 'hdd',
  modelId: 'hdd-skyhawk',
  x: 0.5,
  y: 0.5,
  capacityTb,
})
const ups = (id: string, modelId: string): DesignInfraDevice => ({
  id,
  label: id.toUpperCase(),
  kind: 'ups',
  modelId,
  x: 0.5,
  y: 0.5,
})
const textos = (avisos: { nivel: string; texto: string }[], nivel: string) =>
  avisos.filter((a) => a.nivel === nivel).map((a) => a.texto)

describe('dimensionamiento · grabación', () => {
  it('por defecto son 30 días', () => {
    assert.equal(DIAS_GRABACION_DEFECTO, 30)
    assert.equal(acotarDiasGrabacion(undefined), 30)
    assert.equal(acotarDiasGrabacion('15'), 15)
    assert.equal(acotarDiasGrabacion(0), 1)
    assert.equal(acotarDiasGrabacion(9999), 365)
  })

  it('calcula los TB con la misma fórmula de la lista de materiales', () => {
    const lista = camaras(8)
    const mbps = lista.reduce((s, c) => s + getCameraModelOrDefault(c.modelId).bitrateMbps, 0)
    const g = dimensionarGrabacion(lista, [], [], 30)
    assert.equal(g.camaras, 8)
    assert.equal(g.dias, 30)
    assert.equal(g.tbNecesarios, Math.ceil(estimateStorageTb(mbps, 30) * 10) / 10)
    // El doble de días, el doble de disco (salvo redondeo a 0,1 TB).
    const g60 = dimensionarGrabacion(lista, [], [], 60)
    assert.ok(Math.abs(g60.tbNecesarios - g.tbNecesarios * 2) <= 0.2)
  })

  it('sin grabador ni disco avisa qué falta y qué comprar', () => {
    const g = dimensionarGrabacion(camaras(10), [], [], 30)
    const faltas = textos(g.avisos, 'falta')
    assert.equal(faltas.length, 2)
    assert.match(faltas[0]!, /Falta el grabador: 10 cámaras necesitan uno de 16 canales o más/)
    assert.match(faltas[1]!, /Falta el disco: para 30 días hacen falta [\d.]+ TB \((un disco|\d+ discos) de \d+ TB\)/)
    assert.equal(g.diasConLoColocado, null)
  })

  it('grabador de 8 canales con 10 cámaras: faltan 2 canales', () => {
    const g = dimensionarGrabacion(camaras(10), [nodo('nvr1', 'nvr', 'nvr-ds7608')], [], 30)
    assert.equal(g.canalesColocados, 8)
    assert.match(textos(g.avisos, 'falta')[0]!, /tiene 8 canales y hay 10 cámaras: faltan 2 canales\. Usa uno de 16 canales/)
    const g9 = dimensionarGrabacion(camaras(9), [nodo('nvr1', 'nvr', 'nvr-ds7608')], [], 30)
    assert.match(textos(g9.avisos, 'falta')[0]!, /falta 1 canal\./)
  })

  it('el DS-7732 cuenta 32 canales, no sus 16 puertos PoE', () => {
    const g = dimensionarGrabacion(camaras(20), [nodo('nvr1', 'nvr', 'nvr-ds7732')], [], 30)
    assert.equal(g.canalesColocados, 32)
    assert.match(textos(g.avisos, 'ok')[0]!, /Grabador: 32 canales para 20 cámaras/)
  })

  it('disco corto: dice para cuántos días alcanza', () => {
    const lista = camaras(8)
    const nvr = [nodo('nvr1', 'nvr', 'nvr-ds7608')]
    const necesario = dimensionarGrabacion(lista, nvr, [], 30).tbNecesarios
    const corto = dimensionarGrabacion(lista, nvr, [disco('d1', 1)], 30)
    assert.ok(necesario > 1, `necesario ${necesario}`)
    assert.equal(corto.tbColocados, 1)
    assert.ok(corto.diasConLoColocado! < 30)
    assert.match(
      textos(corto.avisos, 'falta')[0]!,
      new RegExp(`Disco de 1 TB: alcanza para ${corto.diasConLoColocado} días?, no para 30`),
    )
  })

  it('disco suficiente: todo en orden', () => {
    const lista = camaras(8)
    const g = dimensionarGrabacion(lista, [nodo('nvr1', 'nvr', 'nvr-ds7608')], [disco('d1', 20)], 30)
    assert.deepEqual(textos(g.avisos, 'falta'), [])
    assert.ok(g.diasConLoColocado! >= 30)
    assert.match(textos(g.avisos, 'ok')[1]!, /Disco de 20 TB: alcanza para \d+ días \(pediste 30\)/)
  })

  it('más discos que bahías', () => {
    const g = dimensionarGrabacion(
      camaras(4),
      [nodo('dvr1', 'nvr', 'dvr-ds7208')],
      [disco('d1', 8), disco('d2', 8)],
      30,
    )
    assert.ok(textos(g.avisos, 'falta').some((t) => /Hay 2 discos y el grabador solo tiene 1 bahía/.test(t)))
  })

  it('sin cámaras solo informa', () => {
    const g = dimensionarGrabacion([], [], [], 30)
    assert.equal(g.tbNecesarios, 0)
    assert.deepEqual(g.avisos.map((a) => a.nivel), ['info'])
  })

  it('recomienda tamaños comerciales', () => {
    assert.equal(canalesRecomendados(0), 0)
    assert.equal(canalesRecomendados(3), 4)
    assert.equal(canalesRecomendados(8), 8)
    assert.equal(canalesRecomendados(9), 16)
    assert.equal(canalesRecomendados(40), 64)
    assert.equal(canalesRecomendados(70), 128)
    assert.deepEqual(discosRecomendados(0), [])
    assert.deepEqual(discosRecomendados(3.2), [4])
    assert.deepEqual(discosRecomendados(8), [8])
    assert.deepEqual(discosRecomendados(8.1), [10])
    assert.deepEqual(discosRecomendados(30), [16, 16])
    assert.deepEqual(discosRecomendados(45), [16, 16, 16])
  })
})

describe('dimensionamiento · UPS', () => {
  it('suma cámaras, red, grabador y discos', () => {
    const lista = camaras(4)
    const wCam = lista.reduce((s, c) => s + getCameraModelOrDefault(c.modelId).poeWatts, 0)
    const u = dimensionarUps(
      lista,
      [nodo('sw1', 'switch', 'sw-poe-8'), nodo('nvr1', 'nvr', 'nvr-ds7608')],
      [disco('d1', 4)],
      30,
    )
    assert.equal(u.wCamaras, wCam)
    assert.equal(u.wRed, 8)
    assert.equal(u.wGrabadores, 15)
    assert.equal(u.wDiscos, 8)
    assert.equal(u.wTotal, wCam + 8 + 15 + 8)
    assert.equal(u.vaMinimo, Math.ceil(u.wTotal / 0.6 / 0.8))
    assert.equal(u.vaRecomendado, upsRecomendadoVa(u.vaMinimo))
    // 30 min a wTotal con 50 % de batería útil = wTotal Wh.
    assert.equal(u.whBateria, Math.ceil(u.wTotal))
    assert.equal(u.ahBateria12v, Math.ceil(u.whBateria / 12))
    assert.match(textos(u.avisos, 'falta')[0]!, /Falta el UPS: para [\d.]+ W se recomienda uno de \d+ VA o más/)
  })

  it('más minutos piden más batería, no más VA', () => {
    const args = [camaras(4), [nodo('sw1', 'switch', 'sw-poe-8')], []] as const
    const a = dimensionarUps(...args, 30)
    const b = dimensionarUps(...args, 120)
    assert.equal(b.vaRecomendado, a.vaRecomendado)
    assert.equal(b.whBateria, Math.ceil(a.wTotal * 4))
    assert.match(textos(b.avisos, 'info')[0]!, /Para 120 min de respaldo hacen falta unos \d+ Wh/)
  })

  it('UPS colocado: suficiente o corto', () => {
    const equipos = [nodo('sw1', 'switch', 'sw-usw-pro-24-poe'), nodo('nvr1', 'nvr', 'nvr-ds7732')]
    const muchas = camaras(24, 'ezviz-h9c')
    const corto = dimensionarUps(muchas, equipos, [ups('u1', 'ups-600')], 30)
    assert.ok(corto.vaMinimo > 600, `mínimo ${corto.vaMinimo}`)
    assert.match(textos(corto.avisos, 'falta')[0]!, /El UPS de 600 VA queda corto/)
    const bien = dimensionarUps(muchas, equipos, [ups('u1', 'ups-3000-2u')], 30)
    assert.deepEqual(textos(bien.avisos, 'falta'), [])
    assert.match(textos(bien.avisos, 'ok')[0]!, /UPS de 3000 VA: soporta la carga/)
  })

  it('tamaños comerciales y límites', () => {
    assert.equal(upsRecomendadoVa(0), 0)
    assert.equal(upsRecomendadoVa(200), 600)
    assert.equal(upsRecomendadoVa(601), 1000)
    assert.equal(upsRecomendadoVa(3000), 3000)
    assert.equal(upsRecomendadoVa(3500), 6000)
    assert.equal(acotarRespaldoMin(undefined), 30)
    assert.equal(acotarRespaldoMin(1), 5)
    assert.equal(acotarRespaldoMin(100000), 480)
    const vacio = dimensionarUps([], [], [], 30)
    assert.equal(vacio.wTotal, 0)
    assert.deepEqual(vacio.avisos.map((a) => a.nivel), ['info'])
  })
})

describe('dimensionamiento · distancia útil', () => {
  it('lee el ancho de imagen de la resolución del catálogo', () => {
    assert.equal(pixelesHorizontales('1080p'), 1920)
    assert.equal(pixelesHorizontales('2K'), 2304)
    assert.equal(pixelesHorizontales('2K Dual'), 2304)
    assert.equal(pixelesHorizontales('2K QHD'), 2560)
    assert.equal(pixelesHorizontales('4MP'), 2560)
    assert.equal(pixelesHorizontales('3K'), 2880)
    assert.equal(pixelesHorizontales('4K'), 3840)
    assert.equal(pixelesHorizontales('4K Dual'), 3840)
    assert.equal(pixelesHorizontales('8MP'), 3840)
    assert.equal(pixelesHorizontales('6MP'), 3266)
    assert.equal(pixelesHorizontales(''), 1920)
  })

  it('aplica la fórmula de densidad de píxeles', () => {
    // 1920 px con 90°: a 3,84 m la escena mide 7,68 m → 250 px/m.
    assert.equal(distanciaParaDensidad(1920, 90, 250), 3.8)
    assert.equal(distanciaParaDensidad(1920, 90, 125), 7.7)
    assert.equal(distanciaParaDensidad(1920, 90, 25), 38.4)
    assert.equal(distanciaParaDensidad(0, 90, 250), 0)
    // Ángulos extremos no dan infinito ni negativos.
    assert.ok(distanciaParaDensidad(1920, 180, 250) > 0)
  })

  it('más resolución o menos ángulo = más distancia', () => {
    assert.ok(distanciaParaDensidad(3840, 90, 250) > distanciaParaDensidad(1920, 90, 250))
    assert.ok(distanciaParaDensidad(1920, 50, 250) > distanciaParaDensidad(1920, 100, 250))
  })

  it('la H3 3K identifica más cerca de lo que detecta', () => {
    const a = alcanceUtilCamara(cam(1, 'ezviz-h3'))
    assert.equal(a.resolucion, '3K')
    assert.equal(a.pixelesAncho, 2880)
    assert.equal(a.lentes.length, 1)
    const l = a.lentes[0]!
    assert.equal(l.fovDeg, 96)
    assert.equal(l.identificarM, distanciaParaDensidad(2880, 96, 250))
    assert.ok(l.identificarM < l.reconocerM && l.reconocerM < l.detectarM)
    assert.match(resumenAlcanceUtil(a), /^Identifica rostros hasta [\d.]+ m · reconoce personas hasta [\d.]+ m$/)
  })

  it('una cámara de dos lentes da una distancia por lente', () => {
    const a = alcanceUtilCamara(cam(1, 'ezviz-h9c'))
    assert.equal(a.lentes.length, 2)
    const [gran, tele] = a.lentes as [(typeof a.lentes)[number], (typeof a.lentes)[number]]
    assert.equal(gran.fovDeg, 108)
    assert.equal(tele.fovDeg, 55)
    assert.ok(tele.identificarM > gran.identificarM)
    // El resumen del cliente usa la lente que llega más lejos.
    assert.ok(resumenAlcanceUtil(a).startsWith(`Identifica rostros hasta ${tele.identificarM} m`))
  })

  it('si se cierra el ángulo en el plano, la distancia sube', () => {
    const ficha = alcanceUtilCamara(cam(1, 'ezviz-h3')).lentes[0]!
    const cerrada = alcanceUtilCamara({ ...cam(1, 'ezviz-h3'), fovDeg: 60 }).lentes[0]!
    assert.equal(cerrada.fovDeg, 60)
    assert.ok(cerrada.identificarM > ficha.identificarM)
  })
})
