import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DesignCamera } from '@/lib/netvision/types'
import {
  cajaDePuntos,
  cunaDeSector,
  encuadrar,
  hexagono,
  limitesDeZoom,
  mundoDePlano,
  numeroDePin,
  etiquetaCamTactica,
  tintaDelPlano,
  unirCajas,
  zonasDeSector,
  zoomEn,
} from './planoCliente'

const cam = (extra: Partial<DesignCamera> = {}): DesignCamera => ({
  id: 'c1',
  label: 'CAM-01',
  x: 0.5,
  y: 0.5,
  modelId: 'ezviz-h3',
  yawDeg: 0,
  mountHeightM: 2.8,
  ...extra,
})

describe('plano del cliente · número del pin', () => {
  it('usa el número del nombre; sin número, su posición', () => {
    assert.equal(numeroDePin('CAM-03', 0), '03')
    assert.equal(numeroDePin('CAM-12', 4), '12')
    assert.equal(numeroDePin('cam 7', 0), '07')
    assert.equal(numeroDePin('Entrada', 4), '05')
    assert.equal(numeroDePin('  ', 0), '01')
  })
})

describe('tira táctica · Cam 1 a Cam 16', () => {
  it('escribe Cam 1 … Cam 16', () => {
    assert.equal(etiquetaCamTactica('CAM-01', 0), 'Cam 1')
    assert.equal(etiquetaCamTactica('CAM-16', 15), 'Cam 16')
    assert.equal(etiquetaCamTactica('Entrada', 3), 'Cam 4')
  })
})

describe('plano del cliente · zonas de una cámara', () => {
  // Plano de 40 m × 30 m; la H3 a 2.8 m identifica a ~6.8 m y reconoce a ~13.7 m.
  const scale = { metersPerNormX: 40, metersPerNormY: 30 }

  it('las tres zonas crecen hacia afuera y salen de la óptica real', () => {
    const z = zonasDeSector({ radiusNorm: 28 / 35, lensId: 'main' }, cam(), scale)
    assert.ok(Math.abs(z.identificarM - 6.8) < 0.11, `identifica ${z.identificarM}`)
    assert.ok(Math.abs(z.reconocerM - 13.7) < 0.11, `reconoce ${z.reconocerM}`)
    assert.equal(z.alcanceM, 28)
    assert.ok(z.identificarNorm < z.reconocerNorm && z.reconocerNorm < z.alcanceNorm)
    // El radio se mide con el promedio de los dos ejes (35 m por unidad).
    assert.ok(Math.abs(z.identificarNorm - z.identificarM / 35) < 0.002)
  })

  it('nunca pasan del cono dibujado', () => {
    // Cono recortado a 5 m: todo queda dentro.
    const z = zonasDeSector({ radiusNorm: 5 / 35 }, cam(), scale)
    assert.equal(z.alcanceM, 5)
    assert.equal(z.identificarM, 5)
    assert.equal(z.reconocerM, 5)
    assert.equal(z.identificarNorm, z.alcanceNorm)
    assert.equal(z.reconocerNorm, z.alcanceNorm)
  })

  it('con otra lente cambian las distancias', () => {
    const ancha = zonasDeSector({ radiusNorm: 1 }, cam(), scale)
    const tele = zonasDeSector({ radiusNorm: 1 }, cam({ lensFocalMm: 4 }), scale)
    assert.ok(tele.identificarM > ancha.identificarM)
  })

  it('en una cámara de dos lentes cada cono usa la suya', () => {
    const dual = cam({ modelId: 'ezviz-h9c' })
    const gran = zonasDeSector({ radiusNorm: 1, lensId: 'wide' }, dual, scale)
    const tele = zonasDeSector({ radiusNorm: 1, lensId: 'tele' }, dual, scale)
    assert.ok(tele.identificarM > gran.identificarM, `${tele.identificarM} > ${gran.identificarM}`)
  })
})

describe('plano del cliente · encuadre', () => {
  const mundo = mundoDePlano(0.5) // 1000 × 500

  it('el mundo sigue la proporción de la imagen', () => {
    assert.deepEqual(mundoDePlano(0.5), { ancho: 1000, alto: 500, medio: 750 })
    assert.equal(mundoDePlano(null).alto, 750)
  })

  it('encaja el plano entero, centrado', () => {
    const v = encuadrar(null, mundo, 800, 600, 0)
    assert.equal(v.k, 0.8)
    assert.equal(v.x, 0)
    assert.equal(v.y, 100)
  })

  it('si el dibujo ocupa media hoja, lo agranda hasta llenar el marco', () => {
    // El dibujo está en la mitad de arriba de la hoja.
    const caja = { x0: 0, y0: 0, x1: 1, y1: 0.5 }
    const entero = encuadrar(null, mundoDePlano(1), 800, 400, 0)
    const ajustado = encuadrar(caja, mundoDePlano(1), 800, 400, 0)
    assert.equal(entero.k, 0.4)
    assert.equal(ajustado.k, 0.8)
    // La caja queda centrada dentro del marco.
    assert.equal(ajustado.x, 0)
    assert.equal(ajustado.y, 0)
  })

  it('deja margen y no falla con un marco sin tamaño', () => {
    const v = encuadrar(null, mundo, 1056, 556, 28)
    assert.equal(v.k, 1)
    assert.equal(v.x, 28)
    assert.deepEqual(encuadrar(null, mundo, 0, 0), { k: 1, x: 0, y: 0 })
  })

  it('el zoom mantiene fijo el punto bajo el dedo y respeta los límites', () => {
    const v0 = { k: 1, x: 100, y: 50 }
    const v1 = zoomEn(v0, 2, 300, 200, 0.5, 8)
    assert.equal(v1.k, 2)
    // El punto del mundo bajo (300, 200) no se mueve.
    assert.equal((300 - v0.x) / v0.k, (300 - v1.x) / v1.k)
    assert.equal((200 - v0.y) / v0.k, (200 - v1.y) / v1.k)
    assert.equal(zoomEn(v0, 100, 0, 0, 0.5, 8).k, 8)
    assert.equal(zoomEn(v0, 0.001, 0, 0, 0.5, 8).k, 0.5)
    const lim = limitesDeZoom(mundo, 800, 600)
    assert.equal(lim.entero, 0.8)
    assert.ok(lim.min < lim.entero && lim.max > lim.entero)
  })

  it('une las cajas del dibujo y de los equipos', () => {
    assert.deepEqual(
      unirCajas([{ x0: 0.2, y0: 0.1, x1: 0.6, y1: 0.5 }, null, { x0: 0.5, y0: 0.05, x1: 0.9, y1: 0.4 }]),
      { x0: 0.2, y0: 0.05, x1: 0.9, y1: 0.5 },
    )
    assert.equal(unirCajas([null, undefined]), null)
    assert.deepEqual(cajaDePuntos([{ x: 0.3, y: 0.8 }, { x: 0.1, y: 0.2 }]), { x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.8 })
    assert.equal(cajaDePuntos([]), null)
  })
})

describe('plano del cliente · dónde está el dibujo en la hoja', () => {
  const hoja = (ancho: number, alto: number, fondo: number, pintar: (x: number, y: number) => number | null) => {
    const px = new Uint8ClampedArray(ancho * alto * 4)
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const v = pintar(x, y) ?? fondo
        const i = (y * ancho + x) * 4
        px[i] = v
        px[i + 1] = v
        px[i + 2] = v
        px[i + 3] = 255
      }
    }
    return px
  }

  it('hoja blanca con el dibujo en la mitad de arriba', () => {
    // Rejilla de líneas negras entre x 10–89, y 5–44 de una hoja de 100 × 100.
    const px = hoja(100, 100, 255, (x, y) =>
      x >= 10 && x < 90 && y >= 5 && y < 45 && (x % 4 === 0 || y % 4 === 0) ? 20 : null,
    )
    const t = tintaDelPlano(px, 100, 100)
    assert.equal(t.oscuro, false)
    assert.ok(t.caja)
    assert.ok(Math.abs(t.caja!.x0 - 0.1) <= 0.03 && Math.abs(t.caja!.x1 - 0.9) <= 0.03, JSON.stringify(t.caja))
    assert.ok(Math.abs(t.caja!.y0 - 0.05) <= 0.03 && Math.abs(t.caja!.y1 - 0.45) <= 0.03, JSON.stringify(t.caja))
  })

  it('ignora motas sueltas en el margen', () => {
    const px = hoja(100, 100, 255, (x, y) => {
      if (x === 97 && y === 97) return 0 // una mota
      return x >= 20 && x < 60 && y >= 20 && y < 60 && (x % 3 === 0 || y % 3 === 0) ? 10 : null
    })
    const t = tintaDelPlano(px, 100, 100)
    assert.ok(t.caja!.x1 < 0.65 && t.caja!.y1 < 0.65, JSON.stringify(t.caja))
  })

  it('reconoce un plano que ya es oscuro', () => {
    const px = hoja(60, 40, 8, (x, y) => (x > 10 && x < 50 && y % 5 === 0 ? 230 : null))
    const t = tintaDelPlano(px, 60, 40)
    assert.equal(t.oscuro, true)
    assert.ok(t.caja)
  })

  it('hoja vacía o datos incompletos: sin caja', () => {
    assert.equal(tintaDelPlano(hoja(20, 20, 255, () => null), 20, 20).caja, null)
    assert.deepEqual(tintaDelPlano(new Uint8ClampedArray(8), 20, 20), { caja: null, oscuro: false })
  })
})

describe('plano del cliente · formas', () => {
  it('hexágono de seis puntas y cuña de sector', () => {
    assert.equal(hexagono(0, 0, 10).split(' ').length, 6)
    assert.equal(hexagono(0, 0, 10).split(' ')[0], '10.0,0.0')
    assert.equal(cunaDeSector(0, 0, 10, 0, Math.PI / 2), 'M0.0 0.0L10.0 0.0A10.0 10.0 0 0 1 0.0 10.0Z')
    // Más de media vuelta usa el arco grande; la vuelta entera es un círculo.
    assert.match(cunaDeSector(0, 0, 10, 0, Math.PI * 1.5), /A10\.0 10\.0 0 1 1/)
    assert.match(cunaDeSector(0, 0, 10, 0, Math.PI * 2), /^M-10 0a10 10/)
  })
})
