import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DesignCamera, DesignInfraDevice, DesignNetworkNode } from '@/lib/netvision/types'
import { CAMERA_CATALOG, getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
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
  distanciaEnPiso,
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

  it('densidad angular: d = píxeles / (px por metro · ángulo en radianes)', () => {
    // 1800 px repartidos en 90° (π/2 rad): a 1 m hay 1800/(π/2) ≈ 1146 px/m.
    const d = distanciaParaDensidad(1800, 90, 250)
    assert.ok(Math.abs(d - 1800 / (250 * (Math.PI / 2))) < 1e-9)
    // La densidad cae en proporción a la distancia: 10 veces menos exigencia = 10 veces más lejos.
    assert.ok(Math.abs(distanciaParaDensidad(1800, 90, 25) - d * 10) < 1e-9)
    assert.equal(distanciaParaDensidad(0, 90, 250), 0)
    assert.equal(distanciaParaDensidad(1920, 0, 250), 0)
    // Lentes de timbre (170°) dan una distancia razonable, no cero ni infinito.
    const timbre = distanciaParaDensidad(2304, 170, 250)
    assert.ok(timbre > 2 && timbre < 4, String(timbre))
  })

  it('más resolución o menos ángulo = más distancia', () => {
    assert.ok(distanciaParaDensidad(3840, 90, 250) > distanciaParaDensidad(1920, 90, 250))
    assert.ok(distanciaParaDensidad(1920, 50, 250) > distanciaParaDensidad(1920, 100, 250))
  })

  it('el cálculo queda cerca y por debajo de las tablas DORI oficiales de Hikvision', () => {
    // [ancho px, ángulo H de la ficha, distancia de detección de la ficha]
    const fichas: [number, number, number][] = [
      [2688, 103, 67], // DS-2CD2143G2-I 2.8 mm
      [2688, 84, 80], // DS-2CD2143G2-I 4 mm
      [2688, 112, 58], // DS-2CD2T47G2-L 2.8 mm
      [2688, 95, 77], // DS-2CD2T47G2-L 4 mm
      [2688, 58, 115], // DS-2CD2T47G2-L 6 mm
    ]
    for (const [px, fov, oficial] of fichas) {
      const d = distanciaParaDensidad(px, fov, 25)
      assert.ok(d <= oficial, `${fov}°: ${d} no debe prometer más que la ficha (${oficial})`)
      assert.ok(d >= oficial * 0.8, `${fov}°: ${d} demasiado lejos de la ficha (${oficial})`)
    }
  })

  it('pasa la distancia al piso según la altura de montaje', () => {
    // Cámara a 4,6 m, rostro a 1,6 m: 3 m de desnivel. Triángulo 3-4-5.
    assert.ok(Math.abs(distanciaEnPiso(5, 4.6) - 4) < 1e-9)
    // A la altura del rostro o más baja no se pierde nada.
    assert.equal(distanciaEnPiso(5, 1.6), 5)
    assert.equal(distanciaEnPiso(5, 1.2), 5)
    // Si la recta no alcanza ni a bajar hasta el rostro, no llega.
    assert.equal(distanciaEnPiso(3, 4.6), 0)
    assert.equal(distanciaEnPiso(2.9, 4.6), 0)
  })

  it('Hikvision usa la tabla DORI de su ficha', () => {
    const a = alcanceUtilCamara({ ...cam(1, 'hik-ds2cd2143'), mountHeightM: 1.6 })
    const l = a.lentes[0]!
    assert.equal(l.fuente, 'fabricante')
    assert.equal(l.focalMm, 2.8)
    assert.equal(l.fovDeg, 103)
    assert.equal(l.pixelesAncho, 2688)
    // Ficha: D 67 m → R 13,4 m → I 6,7 m (a la altura del rostro no hay corrección).
    assert.equal(l.detectarM, 67)
    assert.equal(l.reconocerM, 13.4)
    assert.equal(l.identificarM, 6.7)
    assert.equal(l.nocheM, 30)
  })

  it('RECORTAR EL CONO EN EL PLANO NO CAMBIA LA DISTANCIA', () => {
    const ficha = alcanceUtilCamara(cam(1, 'hik-ds2cd2143')).lentes[0]!
    for (const fov of [20, 45, 60, 150]) {
      const recortada = alcanceUtilCamara({
        ...cam(1, 'hik-ds2cd2143'),
        fovDeg: fov,
        fovLeftDeg: fov / 2,
        fovRightDeg: fov / 2,
        rangeM: 5,
      }).lentes[0]!
      assert.deepEqual(recortada, ficha, `cono a ${fov}°`)
    }
    // Igual en un modelo sin tabla del fabricante.
    const h3 = alcanceUtilCamara(cam(1, 'ezviz-h3')).lentes[0]!
    const h3Recortada = alcanceUtilCamara({ ...cam(1, 'ezviz-h3'), fovDeg: 20 }).lentes[0]!
    assert.deepEqual(h3Recortada, h3)
    // El caso que salió mal: 20° daba «identifica a 29 m».
    assert.ok(ficha.identificarM < 7, String(ficha.identificarM))
  })

  it('lo que sí la cambia es la lente elegida', () => {
    const de28 = alcanceUtilCamara(cam(1, 'hik-ds2cd2143')).lentes[0]!
    const de4 = alcanceUtilCamara({ ...cam(1, 'hik-ds2cd2143'), lensFocalMm: 4 }).lentes[0]!
    assert.equal(de4.focalMm, 4)
    assert.equal(de4.fovDeg, 84)
    assert.ok(de4.identificarM > de28.identificarM)
    // Ficha de 4 mm: D 80 m.
    assert.equal(alcanceUtilCamara({ ...cam(1, 'hik-ds2cd2143'), lensFocalMm: 4, mountHeightM: 1.6 }).lentes[0]!.detectarM, 80)
    // Una lente que el modelo no tiene se ignora: queda la de ficha.
    const rara = alcanceUtilCamara({ ...cam(1, 'hik-ds2cd2143'), lensFocalMm: 12 }).lentes[0]!
    assert.deepEqual(rara, de28)
    // Ezviz H4 con lente de 6 mm (52°) llega más lejos que con la de 2.8 mm (106°).
    const h4 = alcanceUtilCamara(cam(1, 'ezviz-h4')).lentes[0]!
    const h4de6 = alcanceUtilCamara({ ...cam(1, 'ezviz-h4'), lensFocalMm: 6 }).lentes[0]!
    assert.equal(h4.fuente, 'calculo')
    assert.equal(h4de6.fovDeg, 52)
    assert.ok(h4de6.identificarM > h4.identificarM * 1.8)
  })

  it('siempre identificar ≤ reconocer ≤ detectar, en todo el catálogo', () => {
    for (const m of CAMERA_CATALOG) {
      for (const altura of [1.4, 2.8, 4, 6]) {
        const a = alcanceUtilCamara({ ...cam(1, m.id), mountHeightM: altura })
        assert.ok(a.lentes.length >= 1, m.id)
        for (const l of a.lentes) {
          assert.ok(l.identificarM <= l.reconocerM, `${m.id} a ${altura} m: I ${l.identificarM} > R ${l.reconocerM}`)
          assert.ok(l.reconocerM <= l.detectarM, `${m.id} a ${altura} m: R ${l.reconocerM} > D ${l.detectarM}`)
          assert.ok(l.detectarM > 0 && l.detectarM < 400, `${m.id}: D ${l.detectarM}`)
          assert.ok(l.pixelesAncho >= 1280, m.id)
        }
      }
    }
  })

  it('una cámara de dos lentes usa el ancho de imagen de cada lente', () => {
    const h9c = alcanceUtilCamara(cam(1, 'ezviz-h9c'))
    assert.equal(h9c.lentes.length, 2)
    const [gran, tele] = h9c.lentes as [(typeof h9c.lentes)[number], (typeof h9c.lentes)[number]]
    assert.equal(gran.fovDeg, 108)
    assert.equal(tele.fovDeg, 55)
    assert.equal(tele.focalMm, 6)
    assert.ok(tele.identificarM > gran.identificarM)
    // Aqara G350: gran angular 4K (3840 px) y tele 2.5K (2560 px), no 3840 para las dos.
    const g350 = alcanceUtilCamara(cam(1, 'aqara-g350'))
    assert.deepEqual(g350.lentes.map((l) => l.pixelesAncho), [3840, 2560])
    // El resumen del cliente usa la lente que llega más lejos.
    assert.ok(resumenAlcanceUtil(h9c).startsWith(`Identifica rostros hasta ${tele.identificarM.toFixed(1)} m`))
  })

  it('avisa cuando la altura estropea la identificación', () => {
    const normal = alcanceUtilCamara({ ...cam(1, 'ezviz-h3'), mountHeightM: 2.8 }).lentes[0]!
    assert.equal(normal.aviso, null)
    assert.ok(normal.anguloRostroDeg <= 15)
    const alta = alcanceUtilCamara({ ...cam(1, 'ezviz-h3'), mountHeightM: 6 }).lentes[0]!
    assert.ok(alta.identificarM < normal.identificarM)
    assert.match(alta.aviso!, /A 6 m de altura ve los rostros desde arriba \(\d+°\)/)
    const muyAlta = alcanceUtilCamara({ ...cam(1, 'ezviz-c6n'), mountHeightM: 8 }).lentes[0]!
    assert.equal(muyAlta.identificarM, 0)
    assert.match(muyAlta.aviso!, /A 8 m de altura no llega a identificar rostros/)
    assert.ok(muyAlta.reconocerM > 0)
  })

  it('el resumen respeta las unidades del proyecto', () => {
    const a = alcanceUtilCamara(cam(1, 'ezviz-h3'))
    assert.match(resumenAlcanceUtil(a), /^Identifica rostros hasta [\d.]+ m · reconoce personas hasta [\d.]+ m$/)
    assert.match(resumenAlcanceUtil(a, 'imperial'), /^Identifica rostros hasta [\d.]+ ft · reconoce personas hasta [\d.]+ ft$/)
    const sinRostro = alcanceUtilCamara({ ...cam(1, 'ezviz-c6n'), mountHeightM: 8 })
    assert.match(resumenAlcanceUtil(sinRostro), /^A esta altura no identifica rostros · reconoce personas hasta [\d.]+ m$/)
  })
})
